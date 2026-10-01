import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import { generateInviteCode, hashInviteCode, inviteStatus, normalizeInviteCode } from '../src/utils/adminInvites';
import { cleanCities, describeScope, hospitalScopeSql } from '../src/utils/jurisdiction';
import { createInvite, getOverview, getRequests, setHospitalVerification } from '../src/controllers/adminController';
import { checkAdminInvite, register } from '../src/controllers/authController';
import { requireAdmin } from '../src/middleware/requireAdmin';
import { adminInviteSchema } from '../src/schemas/adminSchemas';
import { sealSecret } from '../src/utils/mfa';

afterEach(() => {
    mock.restoreAll();
    delete process.env.ADMIN_INVITE_CODE;
});

const pune = { userId: 5, isNational: false, state: 'Maharashtra', cities: ['pune', 'pimpri-chinchwad'] };
const DAY = 86400000;

/** Answers queries by the first matching SQL fragment and records every call. */
const fakeQueries = (answers: [string, any[]][]) => {
    const calls: { sql: string; params: any[] }[] = [];
    const run = async (sql: string, params: any[] = []) => {
        calls.push({ sql, params });
        const hit = answers.find(([fragment]) => sql.includes(fragment));
        return { rows: hit ? hit[1] : [], rowCount: hit ? hit[1].length : 0 };
    };
    return { calls, run };
};

test('invite codes are random, readable and survive retyping', () => {
    const codes = new Set(Array.from({ length: 500 }, generateInviteCode));
    assert.equal(codes.size, 500);
    for (const code of codes) {
        assert.match(code, /^LL-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
        assert.doesNotMatch(code.slice(3), /[01OIL]/);
        assert.equal(normalizeInviteCode(code), code);
        assert.equal(normalizeInviteCode(code.toLowerCase().replace(/-/g, ' ')), code);
        assert.equal(normalizeInviteCode(code.slice(3).replace(/-/g, '')), code);
    }
    assert.equal(normalizeInviteCode('LL-ABCD-EFGH-JKMN-PQR'), null);
    assert.equal(normalizeInviteCode('LL-ABCD-EFGH-JKMN-PQR0'), null);
    assert.equal(normalizeInviteCode({ $ne: '' }), null);
    assert.notEqual(hashInviteCode('LL-AAAA-AAAA-AAAA-AAAA'), 'LL-AAAA-AAAA-AAAA-AAAA');
});

test('invite status: used and revoked win over expiry', () => {
    const future = new Date(Date.now() + DAY).toISOString();
    const past = new Date(Date.now() - DAY).toISOString();
    assert.equal(inviteStatus({ expires_at: future }), 'pending');
    assert.equal(inviteStatus({ expires_at: past }), 'expired');
    assert.equal(inviteStatus({ expires_at: past, used_at: past }), 'used');
    assert.equal(inviteStatus({ expires_at: future, revoked_at: past }), 'revoked');
});

test('a city admin only sees hospitals in their cities and state; a national admin sees all', () => {
    const params: unknown[] = [];
    const sql = hospitalScopeSql(pune, params);
    assert.match(sql, /lower\(trim\(h\.city\)\) = ANY\(\$1::text\[\]\)/);
    assert.match(sql, /h\.state = \$2/);
    assert.deepEqual(params, [['pune', 'pimpri-chinchwad'], 'Maharashtra']);

    const none: unknown[] = [];
    assert.equal(hospitalScopeSql({ userId: 1, isNational: true, state: null, cities: [] }, none), 'TRUE');
    assert.deepEqual(none, []);

    assert.deepEqual(cleanCities([' Pune ', 'pune', 'Pimpri  Chinchwad', '']), ['Pune', 'Pimpri Chinchwad']);
    assert.equal(describeScope({ is_national: false, state: 'Maharashtra', cities: ['Pune', 'Pimpri-Chinchwad'] }), 'Pune, Pimpri-Chinchwad, Maharashtra');
    assert.equal(describeScope({ is_national: true, state: null, cities: [] }), 'All India');
});

test('a city admin cannot verify a hospital outside their jurisdiction', async () => {
    const { calls, run } = fakeQueries([]);
    mock.method(db, 'query', run);
    const res = fakeRes();
    await setHospitalVerification({ params: { id: '9' }, body: { verified: true }, adminScope: pune } as any, res);
    assert.equal(res.statusCode, 404);
    assert.match(calls[0]!.sql, /h\.user_id = \$2 AND \(lower\(trim\(h\.city\)\) = ANY\(\$3::text\[\]\)/);
    assert.deepEqual(calls[0]!.params, [true, 9, ['pune', 'pimpri-chinchwad'], 'Maharashtra']);
});

test('overview counts are limited to the admin\'s jurisdiction', async () => {
    const { calls, run } = fakeQueries([['scoped_hospitals', [{ donors: 3, hospitals: 1 }]]]);
    mock.method(db, 'query', run);
    const res = fakeRes();
    await getOverview({ adminScope: pune } as any, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.jurisdiction, 'pune, pimpri-chinchwad, Maharashtra');
    assert.match(calls[0]!.sql, /FROM donors d WHERE lower\(trim\(d\.city\)\) = ANY\(\$3::text\[\]\)/);
});

test('invite form rules: city admins need a state and a city', () => {
    assert.equal(adminInviteSchema.safeParse({ name: 'Rahul Verma', email: 'rahul@example.com' }).success, false);
    assert.equal(adminInviteSchema.safeParse({ name: 'Rahul Verma', email: 'rahul@example.com', state: 'Maharashtra', cities: ['Pune'] }).success, true);
    assert.equal(adminInviteSchema.safeParse({ name: 'Rahul Verma', email: 'rahul@example.com', state: 'Texas', cities: ['Austin'] }).success, false);
    assert.equal(adminInviteSchema.safeParse({ name: 'Asha Rao', email: 'asha@example.com', is_national: true }).success, true);
});

test('creating an invite returns the code once and stores only its hash', async () => {
    const { calls, run } = fakeQueries([
        ['INSERT INTO admin_invites', [{ id: 3, name: 'Rahul Verma', email: 'rahul@example.com', is_national: false, state: 'Maharashtra', cities: ['Pune'], code_hint: 'X', expires_at: new Date(Date.now() + 7 * DAY).toISOString() }]],
    ]);
    mock.method(db, 'query', run);
    const res = fakeRes();
    await createInvite({
        body: { name: 'Rahul Verma', email: 'rahul@example.com', is_national: false, state: 'Maharashtra', cities: ['Pune', 'pune '], valid_days: 7 },
        adminScope: { userId: 1, isNational: true, state: null, cities: [] },
    } as any, res);
    assert.equal(res.statusCode, 201);
    const code: string = res.body.code;
    assert.equal(normalizeInviteCode(code), code);
    const insert = calls.find((c) => c.sql.includes('INSERT INTO admin_invites'))!;
    assert.equal(insert.params[0], hashInviteCode(code));
    assert.equal(insert.params[1], code.slice(-4));
    assert.ok(!insert.params.includes(code), 'the plain code is never stored');
    assert.deepEqual(insert.params[6], ['Pune']);
    assert.ok(calls.some((c) => c.sql.includes('SET revoked_at = now()') && c.params[0] === 'rahul@example.com'), 'older open invites for the same person are cancelled');
});

test('checking codes: setup code, a live invite, and a used invite', async () => {
    process.env.ADMIN_INVITE_CODE = 'LL-setup-secret';
    let answers: [string, any[]][] = [];
    mock.method(db, 'query', async (sql: string) => {
        const hit = answers.find(([f]) => sql.includes(f));
        return { rows: hit ? hit[1] : [] };
    });

    let res = fakeRes();
    await checkAdminInvite({ body: { code: 'LL-setup-secret' } } as any, res);
    assert.deepEqual(res.body, { valid: true, kind: 'setup', is_national: true, jurisdiction: 'All India' });

    answers = [["role = 'admin'", [{ '?column?': 1 }]]];
    res = fakeRes();
    await checkAdminInvite({ body: { code: 'LL-setup-secret' } } as any, res);
    assert.equal(res.body.valid, false);

    const live = { name: 'Rahul Verma', email: 'rahul@example.com', is_national: false, state: 'Maharashtra', cities: ['Pune'], expires_at: new Date(Date.now() + DAY).toISOString() };
    answers = [['FROM admin_invites', [live]]];
    res = fakeRes();
    await checkAdminInvite({ body: { code: 'll 7kqm x2pd 9rta hc4w' } } as any, res);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.email, 'rahul@example.com');
    assert.equal(res.body.jurisdiction, 'Pune, Maharashtra');

    answers = [['FROM admin_invites', [{ ...live, used_at: new Date().toISOString() }]]];
    res = fakeRes();
    await checkAdminInvite({ body: { code: 'LL-7KQM-X2PD-9RTA-HC4W' } } as any, res);
    assert.deepEqual(res.body, { valid: false, reason: 'This invite has already been used.' });

    res = fakeRes();
    await checkAdminInvite({ body: { code: 'hello' } } as any, res);
    assert.equal(res.body.valid, false);
});

/** A fake pg client for the admin sign-up transaction. */
const fakeClient = (answers: [string, any[]][]) => {
    const calls: string[] = [];
    const client = {
        query: async (sql: string) => {
            calls.push(sql.trim().split(/\s+/).slice(0, 4).join(' '));
            const hit = answers.find(([f]) => sql.includes(f));
            return { rows: hit ? hit[1] : [] };
        },
        release: () => { calls.push('release'); },
    };
    mock.method(db.default, 'connect', async () => client);
    return calls;
};
const adminBody = (email: string) => ({ name: 'Rahul Verma', email, password: 'Str0ng*Pass', role: 'admin', admin_invite_code: 'LL-7KQM-X2PD-9RTA-HC4W' });

test('an invite only works with the email it was issued to', async () => {
    const calls = fakeClient([['UPDATE admin_invites SET used_at', [{ id: 3, email: 'rahul@example.com', is_national: false, state: 'Maharashtra', cities: ['Pune'], created_by: 1 }]]]);
    const res = fakeRes();
    res.cookie = () => res;
    await register({ body: adminBody('someone.else@example.com') } as any, res);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /different email/);
    assert.ok(calls.includes('ROLLBACK'), 'the claim is rolled back so the right person can still use it');
    assert.ok(!calls.some((c) => c.startsWith('INSERT INTO users')));
});

test('a valid invite creates a city admin in one transaction, then asks for two-step setup', async () => {
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    const calls = fakeClient([
        ['UPDATE admin_invites SET used_at', [{ id: 3, email: 'rahul@example.com', is_national: false, state: 'Maharashtra', cities: ['Pune'], created_by: 1 }]],
        ['INSERT INTO users', [{ id: 42, name: 'Rahul Verma', email: 'Rahul@example.com', role: 'admin' }]],
    ]);
    // The authenticator setup is stored outside the sign-up transaction
    mock.method(db, 'query', async (sql: string) => ({
        rows: sql.includes('INSERT INTO user_mfa') ? [{ secret_enc: sealSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ') }] : [],
    }));
    let cookieSet = false;
    const res = fakeRes();
    res.cookie = () => { cookieSet = true; return res; };
    await register({ body: adminBody('Rahul@example.com') } as any, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.mfa.mode, 'setup');
    assert.equal(res.body.mfa.role, 'admin');
    assert.ok(!cookieSet, 'no session until the authenticator code is entered');
    assert.deepEqual(calls.filter((c) => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(c)), ['BEGIN', 'COMMIT']);
    assert.ok(calls.some((c) => c.startsWith('INSERT INTO admin_profiles')));
});

test('a used, expired or unknown invite cannot create an admin', async () => {
    const calls = fakeClient([]);
    const res = fakeRes();
    await register({ body: adminBody('rahul@example.com') } as any, res);
    assert.equal(res.statusCode, 403);
    assert.ok(calls.includes('ROLLBACK'));
});

test('deactivated admins are refused and active ones get their jurisdiction', async () => {
    let row: any = { role: 'admin', is_national: false, state: 'Maharashtra', cities: ['Pune'], active: false };
    mock.method(db, 'query', async () => ({ rows: [row] }));
    let res = fakeRes();
    let passed = false;
    const req: any = { user: { id: 5 } };
    await requireAdmin(req, res, () => { passed = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(passed, false);

    row = { ...row, active: true };
    res = fakeRes();
    await requireAdmin(req, res, () => { passed = true; });
    assert.equal(passed, true);
    assert.deepEqual(req.adminScope, { userId: 5, isNational: false, state: 'Maharashtra', cities: ['pune'] });

    row = { role: 'donor' };
    res = fakeRes();
    passed = false;
    await requireAdmin(req, res, () => { passed = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(passed, false);
});

test('admin request list is limited to the jurisdiction and never selects the hospital token', async () => {
    const { calls, run } = fakeQueries([['FROM blood_requests r', [{ id: 1, hospital_name: 'Sassoon', status: 'Open' }]]]);
    mock.method(db, 'query', run);
    const res = fakeRes();
    await getRequests({ adminScope: pune, query: { limit: '9999' } } as any, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.length, 1);
    const { sql, params } = calls[0]!;
    assert.doesNotMatch(sql, /hospital_token/);
    assert.match(sql, /lower\(trim\(h\.city\)\) = ANY\(\$1::text\[\]\)/);
    assert.deepEqual(params, [['pune', 'pimpri-chinchwad'], 'Maharashtra', 500]);
});
