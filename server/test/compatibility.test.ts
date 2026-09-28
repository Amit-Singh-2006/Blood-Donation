import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import {
    BLOOD_GROUPS, COMPATIBLE_DONORS, compatibleDonorGroups, recipientGroupsFor, ELIGIBILITY_WINDOW_SQL,
} from '../src/utils/bloodCompatibility';
import { getPotentialDonors } from '../src/controllers/hospitalController';
import { getMatchedRequests } from '../src/controllers/donorController';

afterEach(() => mock.restoreAll());

test('ABO/Rh table: O- gives to everyone, AB+ receives from everyone', () => {
    assert.deepEqual(compatibleDonorGroups('AB+').sort(), [...BLOOD_GROUPS].sort());
    assert.deepEqual(recipientGroupsFor('O-').sort(), [...BLOOD_GROUPS].sort());
    assert.deepEqual(compatibleDonorGroups('O-'), ['O-']);
    assert.deepEqual(recipientGroupsFor('AB+'), ['AB+']);
});

test('ABO/Rh table: Rh- patients never receive Rh+ blood, and every group can take its own', () => {
    for (const recipient of BLOOD_GROUPS) {
        const donors = COMPATIBLE_DONORS[recipient];
        assert.ok(donors.includes(recipient), recipient);
        assert.ok(donors.includes('O-'), recipient);
        if (recipient.endsWith('-')) assert.ok(donors.every(d => d.endsWith('-')), recipient);
    }
    assert.deepEqual(compatibleDonorGroups('A+').sort(), ['A+', 'A-', 'O+', 'O-']);
    assert.deepEqual(compatibleDonorGroups('Z+'), []);
    assert.deepEqual(recipientGroupsFor(undefined), []);
});

test('getPotentialDonors searches every compatible group, applies the deferral window and ranks by distance', async () => {
    const calls: { sql: string; params: any[] }[] = [];
    mock.method(db, 'query', async (sql: string, params: any[]) => {
        calls.push({ sql, params });
        return calls.length === 1
            ? { rows: [{ id: 5, hospital_id: 7, blood_group: 'AB-', latitude: 28.56, longitude: 77.21 }] }
            : { rows: [] };
    });
    const res = fakeRes();
    await getPotentialDonors({ params: { requestId: '5' }, user: { id: 7, role: 'hospital' } } as any, res);

    assert.equal(res.statusCode, 200);
    const { sql, params } = calls[1]!;
    assert.deepEqual(params[0], ['O-', 'A-', 'B-', 'AB-']);
    assert.equal(params[1], 'AB-');
    assert.deepEqual(params.slice(2), [28.56, 77.21]);
    assert.ok(sql.includes('d.blood_group = ANY($1)'));
    assert.ok(sql.includes(ELIGIBILITY_WINDOW_SQL));
    assert.match(sql, /ORDER BY distance_miles ASC NULLS LAST, \(d\.blood_group = \$2\) DESC/);
});

test('getPotentialDonors falls back to the hospital city without coordinates', async () => {
    const calls: { sql: string; params: any[] }[] = [];
    mock.method(db, 'query', async (sql: string, params: any[]) => {
        calls.push({ sql, params });
        return calls.length === 1
            ? { rows: [{ id: 6, hospital_id: 7, blood_group: 'O+', latitude: null, longitude: null }] }
            : { rows: [] };
    });
    await getPotentialDonors({ params: { requestId: '6' }, user: { id: 7, role: 'hospital' } } as any, fakeRes());

    assert.deepEqual(calls[1]!.params, [['O-', 'O+'], 'O+', 7]);
    assert.ok(calls[1]!.sql.includes('d.city = (SELECT city FROM hospitals WHERE user_id = $3)'));
    assert.ok(calls[1]!.sql.includes('NULL AS distance_miles'));
});

test('getMatchedRequests shows a donor every open request their blood is compatible with', async () => {
    const calls: { sql: string; params: any[] }[] = [];
    mock.method(db, 'query', async (sql: string, params: any[]) => {
        calls.push({ sql, params });
        return { rows: calls.length === 1 ? [{ blood_group: 'O-', city: 'Delhi', latitude: null, longitude: null }] : [] };
    });
    await getMatchedRequests({ user: { id: 3, role: 'donor' } } as any, fakeRes());

    assert.deepEqual([...calls[1]!.params[0]].sort(), [...BLOOD_GROUPS].sort());
    assert.ok(calls[1]!.sql.includes('br.blood_group = ANY($1)'));
});
