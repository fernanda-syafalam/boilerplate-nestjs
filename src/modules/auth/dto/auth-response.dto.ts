import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { userRole } from '../../../infrastructure/database/schema/users.schema';

export const AuthUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string(),
  role: z.enum(userRole.enumValues),
});

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: AuthUserSchema,
});

export type AuthUserBody = z.infer<typeof AuthUserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export class AuthUserDto extends createZodDto(AuthUserSchema) {}
export class AuthResponseDto extends createZodDto(AuthResponseSchema) {}
