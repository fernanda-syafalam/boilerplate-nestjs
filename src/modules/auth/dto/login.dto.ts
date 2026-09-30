import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { EmailSchema } from '../../../common/schemas/email.schema';

export const LoginSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export class LoginDto extends createZodDto(LoginSchema) {}
