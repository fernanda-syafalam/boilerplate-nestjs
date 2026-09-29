import { STATUS_CODES } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PinoLogger } from 'nestjs-pino';
import { ZodError } from 'zod';

/** RFC 7807 body; requestId is an extension member. */
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

/** Members owned by the problem body itself; never copied from the exception. */
const RESERVED_MEMBERS = new Set(['message', 'error', 'statusCode', 'status']);

/** Extension members that may reach the client on 5xx (e.g. /readyz dependency checks). */
const SERVER_ERROR_EXTENSIONS = new Set(['checks']);

function extensionMembers(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([key]) => !RESERVED_MEMBERS.has(key)));
}

function pickAllowed(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => SERVER_ERROR_EXTENSIONS.has(key)),
  );
}

/** Maps every error to application/problem+json. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail: string | undefined;
    let errors: unknown;
    let extensions: Record<string, unknown> = {};

    if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      title = 'Validation Failed';
      errors = exception.flatten();
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

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error({ err: exception }, 'unhandled exception');
    }

    const body: ProblemDetails = {
      ...extensions,
      type: `https://errors.example.com/${status}`,
      title,
      status,
      detail,
      instance: req.url,
      errors,
      requestId: req.id?.toString(),
    };

    reply.status(status).type('application/problem+json').send(body);
  }
}
