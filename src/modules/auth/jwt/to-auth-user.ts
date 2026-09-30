import type { AuthUser } from '../../../common/types/auth-user';
import type { User } from '../../../infrastructure/database/schema/users.schema';

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}
