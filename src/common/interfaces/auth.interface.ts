import { Request } from 'express';
import { UserRole } from '../../entities/user.entity';

export interface AuthenticatedUser {
  id: string;
  login: string;
  role: UserRole;
  branchId?: string;
  iat?: number;
  exp?: number;
}

export interface IAuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
