import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodSerializerDto } from 'nestjs-zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { AuthService } from './auth.service';
import { type AuthResponse, AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';

const REFRESH_COOKIE = 'refresh_token';
const AUTH_ROUTE = 'auth';
const API_VERSION = '1';
// Nest's URI versioning prefixes 'v' (main.ts), so the cookie path must follow the route.
const COOKIE_PATH = `/v${API_VERSION}/${AUTH_ROUTE}`;

@Controller({ path: AUTH_ROUTE, version: API_VERSION })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(AuthResponseDto)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const result = await this.auth.login(body.email, body.password);
    return this.respond(reply, result);
  }

  /** Token is read from the httpOnly cookie, never the body. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(AuthResponseDto)
  async refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const rawToken = req.cookies[REFRESH_COOKIE];
    if (!rawToken) {
      throw new UnauthorizedException('refresh token cookie missing');
    }
    const result = await this.auth.refresh(rawToken);
    return this.respond(reply, result);
  }

  /** The access JWT stays valid until it expires. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const rawToken = req.cookies[REFRESH_COOKIE];
    if (rawToken) {
      await this.auth.logout(rawToken);
    }
    reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  }

  @Get('me')
  @ZodSerializerDto(AuthUserDto)
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  private respond(
    reply: FastifyReply,
    result: Awaited<ReturnType<AuthService['login']>>,
  ): AuthResponse {
    this.setRefreshCookie(reply, result.refreshToken, result.refreshExpiresInSeconds);
    return { accessToken: result.accessToken, user: result.user };
  }

  private setRefreshCookie(reply: FastifyReply, token: string, maxAge: number): void {
    // secure/sameSite/domain come from the plugin defaults in main.ts.
    reply.setCookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      path: COOKIE_PATH,
      maxAge,
    });
  }
}
