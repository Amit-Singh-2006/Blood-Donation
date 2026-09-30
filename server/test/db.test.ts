import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers';
import { types } from 'pg';
import '../src/config/db';

test('TIMESTAMP columns are read as UTC whatever the server time zone', () => {
    const parse = types.getTypeParser(1114);
    assert.equal((parse('2026-09-30 03:37:12.5') as Date).toISOString(), '2026-09-30T03:37:12.500Z');
    assert.equal((parse('2026-09-30 03:37:12') as Date).toISOString(), '2026-09-30T03:37:12.000Z');
});
