import { describe, expect, it } from 'vitest';
import { EmailSchema } from './email.schema';

function emailOfLength(length: number): string {
  const suffix = '@example.com';
  return `${'a'.repeat(length - suffix.length)}${suffix}`;
}

describe('EmailSchema', () => {
  it('trims and lowercases', () => {
    expect(EmailSchema.parse('  Foo@Example.COM ')).toBe('foo@example.com');
  });

  it('rejects a malformed email', () => {
    expect(EmailSchema.safeParse('not-an-email').success).toBe(false);
  });

  it('rejects a 256-char email', () => {
    expect(EmailSchema.safeParse(emailOfLength(256)).success).toBe(false);
  });

  it('accepts a 255-char email', () => {
    expect(EmailSchema.safeParse(emailOfLength(255)).success).toBe(true);
  });
});
