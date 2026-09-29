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
      }
    } else if (exception instanceof Error) {
      this.logger.error({ err: exception }, 'unhandled exception');
    }

    const body: ProblemDetails = {
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
