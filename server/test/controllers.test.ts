import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import * as db from '../src/config/db';
import { verifyDonation } from '../src/controllers/hospitalController';
import { getImpactPrediction, getMatchedRequests } from '../src/controllers/donorController';

afterEach(() => mock.restoreAll());

/** A pg client double that records statements and answers from `handler`. */
const fakeClient = (handler: (sql: string) => { rows: any[] } | Error) => {
    const client = {
        statements: [] as string[],
        released: 0,
        async query(sql: string) {
            client.statements.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
            const out = handler(sql);
            if (out instanceof Error) throw out;
            return out;
        },
        release() { client.released++; },
    };
    mock.method(db.pool, 'connect', async () => client);
    const poolQuery = mock.method(db, 'query', async () => { throw new Error('pool.query used inside a transaction'); });
    return { client, poolQuery };
};

const verifyReq = { user: { id: 7, role: 'hospital' }, body: { donor_id: 3, units: 2 } } as any;

test('verifyDonation runs the whole transaction on one client and commits', async () => {
    const { client, poolQuery } = fakeClient(sql =>
        sql.includes('SELECT blood_group') ? { rows: [{ blood_group: 'O-' }] }
            : { rows: [{ id: 1, donation_date: '2026-09-27' }] });
    const res = fakeRes();
    await verifyDonation(verifyReq, res);

    assert.equal(res.statusCode, 201);
    assert.equal(client.statements[0], 'BEGIN');
    assert.equal(client.statements.at(-1), 'COMMIT');
    assert.equal(client.statements.length, 6);
    assert.equal(poolQuery.mock.callCount(), 0);
    assert.equal(client.released, 1);
});

test('verifyDonation rolls back the donation insert when the donor does not exist', async () => {
    const { client } = fakeClient(sql => sql.includes('SELECT blood_group') ? { rows: [] } : { rows: [{ id: 1 }] });
    const res = fakeRes();
    await verifyDonation(verifyReq, res);

    assert.equal(res.statusCode, 404);
    assert.equal(client.statements.at(-1), 'ROLLBACK');
    assert.ok(!client.statements.includes('COMMIT'));
    assert.equal(client.released, 1);
});

test('verifyDonation rolls back on DB errors without leaking the error text', async () => {
    const { client } = fakeClient(sql => sql.startsWith('INSERT INTO donations')
        ? new Error('insert or update on table "donations" violates foreign key constraint')
        : { rows: [] });
    const res = fakeRes();
    mock.method(console, 'error', () => { });
    await verifyDonation(verifyReq, res);

    assert.equal(res.statusCode, 500);
    assert.doesNotMatch(JSON.stringify(res.body), /foreign key|donations/);
    assert.equal(client.statements.at(-1), 'ROLLBACK');
    assert.equal(client.released, 1);
});

const impactFor = async (urgency: string, current_stock: number) => {
    mock.method(db, 'query', async () => ({ rows: [{ id: 1, blood_group: 'O-', urgency, current_stock }] }));
    const res = fakeRes();
    await getImpactPrediction({ params: { requestId: '1' } } as any, res);
    mock.restoreAll();
    return res.body.impactLevel;
};

test('getImpactPrediction ranks emergencies and very low stock as Critical', async () => {
    assert.equal(await impactFor('Emergency', 50), 'Critical');
    assert.equal(await impactFor('Emergency', 3), 'Critical');
    assert.equal(await impactFor('Normal', 3), 'Critical');
    assert.equal(await impactFor('Urgent', 50), 'High');
    assert.equal(await impactFor('Normal', 7), 'High');
    assert.equal(await impactFor('Normal', 50), 'Normal');
});

test('getMatchedRequests orders by urgency severity, not alphabetically', async () => {
    const sqls: string[] = [];
    mock.method(db, 'query', async (sql: string) => {
        sqls.push(sql);
        return { rows: sql.includes('FROM donors') ? [{ blood_group: 'O-', city: 'Delhi', latitude: null, longitude: null }] : [] };
    });
    await getMatchedRequests({ user: { id: 3, role: 'donor' } } as any, fakeRes());

    const orderBy = sqls.at(-1)!.split('ORDER BY')[1]!;
    assert.match(orderBy, /WHEN 'Emergency' THEN 3 WHEN 'Urgent' THEN 2/);
    assert.doesNotMatch(orderBy, /^\s*br\.urgency DESC/);
});
