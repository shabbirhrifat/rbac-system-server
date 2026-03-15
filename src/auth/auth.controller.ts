import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  getRefreshCookieClearOptions,
  getRefreshCookieName,
  getRefreshCookieOptions,
} from './auth.constants';
import { CurrentAuthUser } from './decorators/current-auth-user.decorator';
import { LoginDto } from './dto/login.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import { AuthService } from './auth.service';
import type { AuthenticatedRequestUser, RequestMetadata } from './auth.types';
import { getRefreshTokenFromRequest } from './utils/token.util';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      loginDto,
      this.getRequestMetadata(request),
    );

    this.setRefreshCookie(response, result.refreshToken);
    return this.stripRefreshToken(result);
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = getRefreshTokenFromRequest(request);

    if (!refreshToken) {
      this.clearRefreshCookie(response);
      throw new UnauthorizedException('Missing refresh token');
    }

    const result = await this.authService.refresh(
      refreshToken,
      this.getRequestMetadata(request),
    );

    this.setRefreshCookie(response, result.refreshToken);
    return this.stripRefreshToken(result);
  }

  @UseGuards(AccessTokenGuard)
  @Post('logout')
  async logout(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.clearRefreshCookie(response);
    return this.authService.logout(authUser.userId, authUser.sessionId);
  }

  @UseGuards(AccessTokenGuard)
  @Post('logout-all')
  async logoutAll(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.clearRefreshCookie(response);
    return this.authService.logoutAll(authUser.userId);
  }

  @UseGuards(AccessTokenGuard)
  @Get('me')
  getCurrentUser(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.authService.getCurrentUser(authUser.userId, authUser.sessionId);
  }

  @Get('route-context')
  getRouteContext(@Req() request: Request) {
    return this.authService.getRouteContext(request);
  }

  @UseGuards(AccessTokenGuard)
  @Get('sessions')
  listSessions(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.authService.listSessions(authUser.userId, authUser.sessionId);
  }

  @UseGuards(AccessTokenGuard)
  @Delete('sessions/:id')
  async revokeSession(
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (sessionId === authUser.sessionId) {
      this.clearRefreshCookie(response);
    }

    return this.authService.revokeSession(authUser.userId, sessionId);
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(
      getRefreshCookieName(),
      refreshToken,
      getRefreshCookieOptions(),
    );
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(
      getRefreshCookieName(),
      getRefreshCookieClearOptions(),
    );
  }

  private stripRefreshToken<T extends { refreshToken: string }>(
    result: T,
  ): Omit<T, 'refreshToken'> {
    const { refreshToken, ...responsePayload } = result;
    void refreshToken;
    return responsePayload;
  }

  private getRequestMetadata(request: Request): RequestMetadata {
    return {
      ipAddress: request.ip ?? null,
      userAgent: request.headers['user-agent'] ?? null,
    };
  }
}
