import { type ArgumentsHost, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface ProblemDetailsResponse {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  requestId?: string;
  errors?: unknown;
  checks?: unknown;
}

function fakeHost(opts: { url?: string; reqId?: string } = {}): {
  host: ArgumentsHost;
  status: ReturnType<typeof vi.fn>;
  type: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
} {
  const send = vi.fn();
  const type = vi.fn().mockReturnValue({ send });
  const status = vi.fn().mockReturnValue({ type });
  const reply = { status };
  const req = { url: opts.url ?? '/x', id: opts.reqId };
  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, type, send };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let logger: { error: ReturnType<typeof vi.fn>; setContext: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    logger = { error: vi.fn(), setContext: vi.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [AllExceptionsFilter, { provide: PinoLogger, useValue: logger }],
    }).compile();
    filter = moduleRef.get(AllExceptionsFilter);
  });

  it('maps a NestJS HttpException to its status with RFC 7807 body', () => {
    const { host, status, type, send } = fakeHost({ url: '/v1/users/abc', reqId: 'req-1' });

    filter.catch(new NotFoundException('user not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(type).toHaveBeenCalledWith('application/problem+json');
    const body = send.mock.calls[0]?.[0] as ProblemDetailsResponse;
    expect(body).toMatchObject({
      type: 'https://errors.example.com/404',
      status: 404,
      instance: '/v1/users/abc',
      requestId: 'req-1',
    });
    expect(body.title).toBe('user not found');
  });

  it('maps a ZodError to 400 Validation Failed', () => {
    const { host, status, send } = fakeHost();

    let zodError: z.ZodError;
    try {
      z.object({ x: z.number() }).parse({ x: 'not a number' });
      throw new Error('unreachable');
    } catch (err) {
      zodError = err as z.ZodError;
    }

    filter.catch(zodError, host);

    expect(status).toHaveBeenCalledWith(400);
    const body = send.mock.calls[0]?.[0] as ProblemDetailsResponse;
    expect(body.title).toBe('Validation Failed');
    expect(body.errors).toBeDefined();
  });

  it('hides server-side errors and logs the stack', () => {
    const { host, status, send } = fakeHost();

    filter.catch(new Error('database is on fire'), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = send.mock.calls[0]?.[0] as ProblemDetailsResponse;
    expect(body.status).toBe(500);
    // Internal Server Error title; the original message must not leak.
    expect(body.title).toBe('Internal Server Error');
    expect(body.detail).toBeUndefined();
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('passes through detail and errors when an HttpException carries them', () => {
    const { host, send } = fakeHost();

    filter.catch(
      new HttpException(
        { message: 'Bad Request', detail: 'fields are invalid', errors: { x: 'required' } },
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );

    const body = send.mock.calls[0]?.[0] as ProblemDetailsResponse;
    expect(body.title).toBe('Bad Request');
    expect(body.detail).toBe('fields are invalid');
    expect(body.errors).toEqual({ x: 'required' });
  });

  it('uses the reason phrase as title for a 5xx HttpException and logs it', () => {
    const { host, status, send } = fakeHost();

    filter.catch(new HttpException('pg password leaked', HttpStatus.BAD_GATEWAY), host);

    expect(status).toHaveBeenCalledWith(502);
    const body = send.mock.calls[0]?.[0] as ProblemDetailsResponse;
    expect(body.title).toBe('Bad Gateway');
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('logs and returns 500 for a thrown non-Error value', () => {
    const { host, status, send } = fakeHost();

    filter.catch('boom', host);

    expect(status).toHaveBeenCalledWith(500);
    const body = send.mock.calls[0]?.[0] as ProblemDetailsResponse;
    expect(body.title).toBe('Internal Server Error');
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('preserves extension members such as checks', () => {
    const { host, send } = fakeHost();

    filter.catch(
      new HttpException(
        { status: 'error', message: 'x', checks: { database: 'down', redis: 'ok' } },
        HttpStatus.SERVICE_UNAVAILABLE,
      ),
      host,
    );

    const body = send.mock.calls[0]?.[0] as ProblemDetailsResponse;
    expect(body.checks).toEqual({ database: 'down', redis: 'ok' });
    expect(body.status).toBe(503);
    expect(body.title).toBe('Service Unavailable');
  });

  it('strips detail, errors and unlisted extensions from a 5xx body', () => {
    const { host, send } = fakeHost();

    filter.catch(
      new HttpException(
        { message: 'x', detail: 'pg down at 10.0.0.5', errors: { a: 1 }, secret: 's3' },
        HttpStatus.BAD_GATEWAY,
      ),
      host,
    );

    const body = send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.detail).toBeUndefined();
    expect(body.errors).toBeUndefined();
    expect(body.secret).toBeUndefined();
    expect(body.title).toBe('Bad Gateway');
  });

  it('keeps extension members on a 4xx body', () => {
    const { host, send } = fakeHost();

    filter.catch(new HttpException({ message: 'x', hint: 'try again' }, HttpStatus.CONFLICT), host);

    const body = send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.hint).toBe('try again');
  });
});
