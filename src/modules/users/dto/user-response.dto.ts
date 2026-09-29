import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Undeclared fields are stripped by @ZodSerializerDto. */
export const UserResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string(),
  role: z.enum(['admin', 'staff', 'customer']),
  createdAt: z.iso.datetime(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

export class UserResponseDto extends createZodDto(UserResponseSchema) {}
