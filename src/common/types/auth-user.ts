import type { UserRole } from '../../infrastructure/database/schema/users.schema';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}
