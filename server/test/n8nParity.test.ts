import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BLOOD_GROUPS, COMPATIBLE_DONORS, DEFERRAL_DAYS, recipientGroupsFor } from '../src/utils/bloodCompatibility';

// The n8n Code nodes carry their own copies of the matching rules; these tests
// fail if a copy drifts from server/src/utils/bloodCompatibility.ts.
const WORKFLOW_DIR = path.join(__dirname, '..', '..', 'n8n', 'workflows');
const sources = fs.readdirSync(WORKFLOW_DIR)
    .filter(f => f.endsWith('.workflow.ts'))
    .map(f => ({ file: f, text: fs.readFileSync(path.join(WORKFLOW_DIR, f), 'utf8') }));

const literals = (name: string) => sources.flatMap(({ file, text }) =>
    [...text.matchAll(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\});`, 'g'))]
        .map(m => ({ file, value: new Function(`return ${m[1]}`)() })));

test('n8n compatibility engine uses the same ABO/Rh table as the server', () => {
    const copies = literals('COMPATIBLE_DONORS');
    assert.ok(copies.length >= 1, 'no COMPATIBLE_DONORS table found in n8n/workflows');
    for (const { file, value } of copies) assert.deepEqual(value, COMPATIBLE_DONORS, file);
});

test('n8n deferral windows match the server', () => {
    const copies = literals('DEFERRAL_DAYS');
    assert.ok(copies.length >= 4, 'expected the deferral window in every eligibility check');
    for (const { file, value } of copies) assert.deepEqual(value, DEFERRAL_DAYS, file);
});

test('donor registry "your blood can help" map is the inverse of the ABO/Rh table', () => {
    const copies = literals('CAN_HELP');
    assert.ok(copies.length >= 1, 'no CAN_HELP map found in n8n/workflows');
    for (const { file, value } of copies) {
        for (const group of BLOOD_GROUPS) {
            assert.deepEqual([...value[group]].sort(), recipientGroupsFor(group).sort(), `${file} ${group}`);
        }
    }
});
