import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare const getDonorDonations: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getMatchedRequests: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getLeaderboard: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getImpactPrediction: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=donorController.d.ts.map