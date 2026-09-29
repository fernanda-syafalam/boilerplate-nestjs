import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { userRole } from '../../../infrastructure/database/schema/users.schema';

export const UserResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string(),
  role: z.enum(userRole.enumValues),
  createdAt: z.date(),
});

export const UserPageResponseSchema = z.object({
  items: z.array(UserResponseSchema),
  nextCursor: z.string().nullable(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

export class UserResponseDto extends createZodDto(UserResponseSchema) {}
export class UserPageResponseDto extends createZodDto(UserPageResponseSchema) {}
