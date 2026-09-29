import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { type CursorPayload, decodeCursor } from '../users.cursor';

/** cursor is decoded here, so a malformed one is a 400 and `cursor` is the parsed payload. */
export const ListUsersQuerySchema = z.object({
  cursor: z
    .string()
    .max(512)
    .optional()
    .transform((raw, ctx): CursorPayload | undefined => {
      if (raw === undefined) return undefined;
      const decoded = decodeCursor(raw);
      if (!decoded) {
        ctx.addIssue({ code: 'custom', message: 'invalid cursor' });
        return undefined;
      }
      return decoded;
    }),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export class ListUsersQueryDto extends createZodDto(ListUsersQuerySchema) {}
