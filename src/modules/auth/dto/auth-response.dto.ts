import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AuthUserSchema } from '../../../common/types/auth-user';

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: AuthUserSchema,
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export class AuthUserDto extends createZodDto(AuthUserSchema) {}
export class AuthResponseDto extends createZodDto(AuthResponseSchema) {}
