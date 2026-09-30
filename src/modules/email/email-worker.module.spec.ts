import { describe, expect, it } from 'vitest';
import type { AppConfigService } from '../../config';
import { selectEmailGateway } from './email-worker.module';
import type { LoggingEmailGateway } from './email.gateway';

const logging = {} as LoggingEmailGateway;
const configFor = (nodeEnv: string) => ({ get: () => nodeEnv }) as unknown as AppConfigService;

describe('selectEmailGateway', () => {
  it('throws in production so the worker refuses to start', () => {
    expect(() => selectEmailGateway(configFor('production'), logging)).toThrow(
      'no production EmailGateway configured',
    );
  });

  it('uses the logging gateway outside production', () => {
    expect(selectEmailGateway(configFor('development'), logging)).toBe(logging);
  });
});
