import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { EmailSchema } from '../../../common/schemas/email.schema';

/** strict() rejects unknown keys (mass-assignment). */
export const CreateUserSchema = z
  .object({
    email: EmailSchema,
    fullName: z.string().trim().min(1).max(120),
    password: z.string().min(12).max(128),
  })
  .strict();

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
