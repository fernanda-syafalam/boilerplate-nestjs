import type { UserRole } from '../../infrastructure/database/schema/users.schema';

export interface JwtPayload {
  sub: string;
  role: UserRole;
}
