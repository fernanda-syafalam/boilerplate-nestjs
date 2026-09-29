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
import {
  type AuthResponse,
  AuthResponseDto,
  type AuthUserBody,
  AuthUserDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';

type CookieRequest = FastifyRequest & { cookies: Record<string, string | undefined> };

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_PATH = '/v1/auth';

@Controller({ path: 'auth', version: '1' })
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
    this.setRefreshCookie(reply, result.refreshToken, result.refreshExpiresInSeconds);
    return { accessToken: result.accessToken, user: result.user };
  }

  /** Token is read from the httpOnly cookie, never the body. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(AuthResponseDto)
  async refresh(
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const rawToken = req.cookies[REFRESH_COOKIE];
    if (!rawToken) {
      throw new UnauthorizedException('refresh token cookie missing');
    }
    const result = await this.auth.refresh(rawToken);
    this.setRefreshCookie(reply, result.refreshToken, result.refreshExpiresInSeconds);
    return { accessToken: result.accessToken, user: result.user };
  }

  /** The access JWT stays valid until it expires. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: CookieRequest,
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
  me(@CurrentUser() user: AuthUser): AuthUserBody {
    return user;
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
