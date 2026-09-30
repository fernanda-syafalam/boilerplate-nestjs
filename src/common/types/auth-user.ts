import { z } from 'zod';
import { userRole } from '../../infrastructure/database/schema/users.schema';

export const AuthUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string(),
  role: z.enum(userRole.enumValues),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
