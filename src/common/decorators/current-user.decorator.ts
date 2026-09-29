import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'staff' | 'customer';
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest & { user: AuthUser }>();
    return req.user;
  },
);
