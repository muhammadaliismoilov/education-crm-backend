import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../entities/user.entity';

export const Roles = (...roles: (keyof typeof UserRole | string)[]) => SetMetadata('roles', roles);