import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOOD_GROUPS, COMPATIBLE_DONORS, compatibleDonorGroups, recipientGroupsFor } from '../src/utils/bloodCompatibility';

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
