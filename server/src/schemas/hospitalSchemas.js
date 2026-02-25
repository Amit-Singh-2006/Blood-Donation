"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyDonationSchema = exports.updateHospitalInventorySchema = exports.createHospitalRequestSchema = void 0;
const zod_1 = require("zod");
exports.createHospitalRequestSchema = zod_1.z.object({
    blood_group: zod_1.z.string().min(1, "Blood group is required"),
    units_required: zod_1.z.number().positive("Units required must be positive"),
    urgency: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
});
exports.updateHospitalInventorySchema = zod_1.z.object({
    blood_group: zod_1.z.string().min(1, "Blood group is required"),
    units: zod_1.z.number().min(0, "Units cannot be negative"),
});
exports.verifyDonationSchema = zod_1.z.object({
    donor_id: zod_1.z.number().positive(),
    units: zod_1.z.number().positive("Units must be positive"),
    xp_earned: zod_1.z.number().positive().optional(),
});
//# sourceMappingURL=hospitalSchemas.js.map