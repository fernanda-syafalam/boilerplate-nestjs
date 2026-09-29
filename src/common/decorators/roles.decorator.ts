import { SetMetadata } from '@nestjs/common';
import type { AuthUser } from '../types/auth-user';

export const ROLES_KEY = 'roles';

/** Resource ownership stays in the service, not in guards. */
export const Roles = (...roles: AuthUser['role'][]) => SetMetadata(ROLES_KEY, roles);
