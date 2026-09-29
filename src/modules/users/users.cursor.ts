import { z } from 'zod';

const CursorPayloadSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
});

export type CursorPayload = z.infer<typeof CursorPayloadSchema>;

export function encodeCursor(u: { id: string; createdAt: Date }): string {
  const payload: CursorPayload = {
    id: u.id,
    createdAt: u.createdAt.toISOString(),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/** Returns null for anything that is not a cursor we issued. */
export function decodeCursor(s: string): CursorPayload | null {
  try {
    const parsed = CursorPayloadSchema.safeParse(
      JSON.parse(Buffer.from(s, 'base64url').toString('utf8')),
    );
    return parsed.success ? parsed.data : null;
  } catch (_err) {
    return null;
  }
}
