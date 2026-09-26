import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHospitalRequestSchema } from '../src/schemas/hospitalSchemas';

test('accepts the dashboard form payload and maps it to DB values', () => {
    // Exactly what HospitalDashboard posts: units as a string, urgency 'standard'
    const result = createHospitalRequestSchema.safeParse({
        blood_group: 'O+', units_required: '3', urgency: 'standard', expires_in_days: '3',
    });
    assert.ok(result.success, JSON.stringify(!result.success && result.error.issues));
    assert.equal(result.data.units_required, 3);
    assert.equal(result.data.urgency, 'Normal');
});

test('maps every accepted urgency onto the blood_requests CHECK constraint', () => {
    const cases: Record<string, string> = {
        standard: 'Normal', low: 'Normal', medium: 'Normal', Normal: 'Normal',
        high: 'Urgent', Urgent: 'Urgent',
        critical: 'Emergency', Emergency: 'Emergency',
    };
    for (const [input, expected] of Object.entries(cases)) {
        const result = createHospitalRequestSchema.safeParse({ blood_group: 'AB-', units_required: 2, urgency: input });
        assert.ok(result.success, input);
        assert.equal(result.data.urgency, expected, input);
        assert.ok(['Normal', 'Urgent', 'Emergency'].includes(result.data.urgency));
    }
});

test('rejects input the database would reject with a 500', () => {
    const base = { blood_group: 'O-', units_required: 2, urgency: 'critical' };
    assert.equal(createHospitalRequestSchema.safeParse({ ...base, blood_group: 'Z+' }).success, false);
    assert.equal(createHospitalRequestSchema.safeParse({ ...base, units_required: 2.5 }).success, false);
    assert.equal(createHospitalRequestSchema.safeParse({ ...base, units_required: '' }).success, false);
    assert.equal(createHospitalRequestSchema.safeParse({ ...base, urgency: 'asap' }).success, false);
});
