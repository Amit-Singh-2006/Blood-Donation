"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const validateRequest = (schema) => {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                message: "Validation failed",
                errors: result.error.issues.map((err) => ({
                    path: err.path.join('.'),
                    message: err.message
                }))
            });
            return;
        }
        // Optionally update req.body with the parsed data
        req.body = result.data;
        next();
    };
};
exports.validateRequest = validateRequest;
//# sourceMappingURL=validateZod.js.map