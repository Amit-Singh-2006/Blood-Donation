import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodIssue } from 'zod';

export const validateRequest = (schema: ZodSchema<any>) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            // The first problem, in words, so forms can show it as-is
            const first = result.error.issues[0];
            res.status(400).json({
                message: first?.message && !first.message.startsWith('Invalid input') ? first.message : 'Validation failed',
                errors: result.error.issues.map((err: ZodIssue) => ({
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
