import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
/**
 * CRITICAL: Double-check admin role directly in the database.
 * Prevents JWT role forgery — even if an attacker tampers with a token,
 * the role is verified against the live DB record, not just the token payload.
 */
export declare const requireAdmin: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=requireAdmin.d.ts.map