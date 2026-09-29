import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LoginSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(1).max(128),
  })
  .strict();

export class LoginDto extends createZodDto(LoginSchema) {}
