"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfileSchema = void 0;
const zod_1 = require("zod");
exports.updateProfileSchema = zod_1.z.object({
    latitude: zod_1.z.number().optional().nullable(),
    longitude: zod_1.z.number().optional().nullable(),
    city: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
});
//# sourceMappingURL=userSchemas.js.map