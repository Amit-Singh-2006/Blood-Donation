import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare const getHospitalDonations: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getHospitalInventory: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getHospitalRequests: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createHospitalRequest: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateHospitalInventory: (req: AuthRequest, res: Response) => Promise<void>;
export declare const verifyDonation: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getPotentialDonors: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=hospitalController.d.ts.map