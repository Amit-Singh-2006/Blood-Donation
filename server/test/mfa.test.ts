import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
    base32Decode, base32Encode, generateSecret, hashBackupCode, matchTotp, newBackupCodes,
    openSecret, readPendingToken, sealSecret, signPendingToken, totpAt,
} from '../src/utils/mfa';

process.env.JWT_SECRET ??= 'test-jwt-secret';

// The SHA-1 key from RFC 6238's test vectors
const RFC_KEY = Buffer.from('12345678901234567890');

test('codes match the RFC 6238 test vectors (what authenticator apps show)', () => {
    assert.equal(totpAt(RFC_KEY, Math.floor(59 / 30)), '287082');
    assert.equal(totpAt(RFC_KEY, Math.floor(1111111109 / 30)), '081804');
    assert.equal(totpAt(RFC_KEY, Math.floor(1234567890 / 30)), '005924');
    assert.equal(totpAt(RFC_KEY, Math.floor(2000000000 / 30)), '279037');
});

test('secrets are 160-bit base32, as authenticator apps expect', () => {
    assert.equal(base32Encode(RFC_KEY), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    assert.deepEqual(base32Decode('gezd gnbv gy3t qojq gezd gnbv gy3t qojq'), RFC_KEY);
    assert.equal(base32Decode(generateSecret()).length, 20);
    assert.notEqual(generateSecret(), generateSecret());
});

test('a code works once, allowing one step of clock drift either way', () => {
    const now = 1_790_000_000_000;
    const step = Math.floor(now / 30000);
    assert.equal(matchTotp(RFC_KEY, totpAt(RFC_KEY, step), null, now), step);
    assert.equal(matchTotp(RFC_KEY, totpAt(RFC_KEY, step - 1), null, now), step - 1, 'phone clock 30 s behind');
    assert.equal(matchTotp(RFC_KEY, totpAt(RFC_KEY, step + 1), null, now), step + 1, 'phone clock 30 s ahead');
    assert.equal(matchTotp(RFC_KEY, totpAt(RFC_KEY, step), step, now), null, 'the same code again is refused');
    assert.equal(matchTotp(RFC_KEY, totpAt(RFC_KEY, step - 4), null, now), null, 'an old code is refused');
    assert.equal(matchTotp(RFC_KEY, 'abc123', null, now), null);
    assert.equal(matchTotp(RFC_KEY, '12345', null, now), null);
});

test('authenticator secrets are stored encrypted and tamper-evident', () => {
    const secret = generateSecret();
    const sealed = sealSecret(secret);
    assert.ok(!sealed.includes(secret));
    assert.equal(openSecret(sealed), secret);
    const [version, iv, tag] = sealed.split(':');
    assert.throws(() => openSecret([version, iv, tag, Buffer.from('tampered').toString('base64')].join(':')));
});

test('the ticket between password and code can never pass as a session', () => {
    const ticket = signPendingToken(7, 'hospital', 'verify');
    assert.deepEqual(readPendingToken(ticket), { uid: 7, role: 'hospital', mode: 'verify', remember: false });
    assert.equal(readPendingToken(signPendingToken(7, 'hospital', 'verify', true))?.remember, true);
    assert.throws(() => jwt.verify(ticket, process.env.JWT_SECRET as string), 'not a valid session token');
    const forged = jwt.sign({ uid: 7, role: 'hospital', mode: 'verify' }, process.env.JWT_SECRET as string);
    assert.equal(readPendingToken(forged), null, 'a session-key token is not a ticket');
    assert.equal(readPendingToken('nonsense'), null);
    assert.equal(readPendingToken(undefined), null);
});

test('backup codes are random, single-format, and compared by hash', () => {
    const codes = newBackupCodes();
    assert.equal(codes.length, 10);
    assert.equal(new Set(codes).size, 10);
    for (const c of codes) assert.match(c, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    const first = codes[0]!;
    assert.equal(hashBackupCode(first.toLowerCase().replace('-', ' ')), hashBackupCode(first), 'case and spacing do not matter');
    assert.notEqual(hashBackupCode(first), hashBackupCode(codes[1]!));
});
