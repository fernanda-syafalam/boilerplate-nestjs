import { STATUS_CODES } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PinoLogger } from 'nestjs-pino';
import { ZodError } from 'zod';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  errors?: unknown;
  requestId?: string;
  [extension: string]: unknown;
}

const RESERVED_MEMBERS = new Set(['message', 'error', 'statusCode', 'status']);

const SERVER_ERROR_EXTENSIONS = new Set(['checks']);

function extensionMembers(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([key]) => !RESERVED_MEMBERS.has(key)));
}

function pickAllowed(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => SERVER_ERROR_EXTENSIONS.has(key)),
  );
}

interface Problem {
  status: number;
  body: ProblemDetails;
}

/** Pure mapping: no logging, no IO, so the RFC 7807 shape is testable without a reply. */
function toProblem(exception: unknown, request: { url: string; id?: unknown }): Problem {
  let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
  let title = 'Internal Server Error';
  let detail: string | undefined;
  let errors: unknown;
  let extensions: Record<string, unknown> = {};

  if (exception instanceof ZodError) {
    status = HttpStatus.BAD_REQUEST;
    // Must match the global ZodValidationPipe body (issues + lowercase title) so clients parse one shape.
    title = 'Validation failed';
    errors = exception.issues;
  } else if (exception instanceof HttpException) {
    status = exception.getStatus();
    const res = exception.getResponse();
    title = exception.message;
    if (typeof res === 'object' && res !== null) {
      const obj = res as Record<string, unknown>;
      if (typeof obj.message === 'string') title = obj.message;
      if (typeof obj.detail === 'string') detail = obj.detail;
      if ('errors' in obj) errors = obj.errors;
      extensions = extensionMembers(obj);
    }
    // 5xx bodies may carry internals; expose only the standard phrase and allowlisted members.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      title = STATUS_CODES[status] ?? 'Internal Server Error';
      detail = undefined;
      errors = undefined;
      extensions = pickAllowed(extensions);
    }
  }

  return {
    status,
    body: {
      ...extensions,
      type: `https://errors.example.com/${status}`,
      title,
      status,
      detail,
      instance: request.url,
      errors,
      requestId: request.id?.toString(),
    },
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const { status, body } = toProblem(exception, ctx.getRequest<FastifyRequest>());

    this.logServerError(exception, status);

    reply.status(status).type('application/problem+json').send(body);
  }

  private logServerError(exception: unknown, status: number): void {
    if (status < HttpStatus.INTERNAL_SERVER_ERROR) return;
    // A thrown 503 is the readiness probe reporting a down dependency, not a bug; error-level would alert on every probe.
    if (exception instanceof ServiceUnavailableException) {
      this.logger.warn({ err: exception }, 'service unavailable');
    } else {
      this.logger.error({ err: exception }, 'unhandled exception');
    }
  }
}
