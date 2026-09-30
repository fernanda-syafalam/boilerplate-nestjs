import { z } from 'zod';

/** API -> worker job contract; lives outside the worker-side gateway so the producer does not depend on it. */
export const SendEmailRequestSchema = z.object({
  to: z.email(),
  templateId: z.string().min(1),
  variables: z.record(z.string(), z.string()),
  idempotencyKey: z.string().min(1),
});

export type SendEmailRequest = z.infer<typeof SendEmailRequestSchema>;

/** Paths and codes only: issue messages/values may echo the recipient address. */
export function describeIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}:${i.code}`).join(', ');
}
