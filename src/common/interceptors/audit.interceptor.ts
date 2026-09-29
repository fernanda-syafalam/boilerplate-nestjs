import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { PinoLogger } from 'nestjs-pino';
import { type Observable, tap } from 'rxjs';
import { AUDIT_KEY } from '../decorators/audit.decorator';
import type { AuthUser } from '../types/auth-user';

interface AuditEvent {
  audit: true;
  action: string;
  actor: string | null;
  target: unknown;
  outcome: 'success' | 'failure';
  err?: string;
}

/** Secrets are stripped by pino redact; the log shipper routes audit:true lines. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext('audit');
  }

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<string | undefined>(AUDIT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!action) return next.handle();

    const req = ctx
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthUser; params: unknown }>();
    const actor = req.user?.id ?? null;
    const target = req.params;

    return next.handle().pipe(
      tap({
        next: () => {
          const event: AuditEvent = { audit: true, action, actor, target, outcome: 'success' };
          this.logger.info(event, 'audit event');
        },
        error: (err: unknown) => {
          const event: AuditEvent = {
            audit: true,
            action,
            actor,
            target,
            outcome: 'failure',
            err: err instanceof Error ? err.message : String(err),
          };
          this.logger.warn(event, 'audit event');
        },
      }),
    );
  }
}
