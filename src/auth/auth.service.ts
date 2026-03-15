import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, RefreshSession, UserStatus } from '@prisma/client';
import {
  AccessControlService,
  ResolvedAccessProfile,
} from '../access-control/access-control.service';
import { PrismaService } from '../database/prisma.service';
import {
  AUTH_LOGIN_ATTEMPT_WINDOW_MS,
  AUTH_LOGIN_LOCK_MS,
  AUTH_MAX_FAILED_ATTEMPTS,
  getAccessTokenExpiresInSeconds,
  getRefreshTokenExpiresInMs,
  getAccessTokenSecret,
  getRefreshTokenSecret,
} from './auth.constants';
import { LoginDto } from './dto/login.dto';
import {
  AccessTokenPayload,
  AuthenticatedRequestUser,
  RefreshTokenPayload,
  RequestMetadata,
} from './auth.types';
import { verifyPassword } from './utils/password.util';
import {
  extractBearerToken,
  getRefreshTokenFromRequest,
  hashOpaqueToken,
} from './utils/token.util';
import type { Request } from 'express';

type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresInMs: number;
  accessProfile: ResolvedAccessProfile;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly accessControlService: AccessControlService,
  ) {}

  async login(loginDto: LoginDto, metadata: RequestMetadata) {
    const email = loginDto.email.trim().toLowerCase();

    await this.throwIfLoginRateLimited(email, metadata.ipAddress);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
      },
    });

    if (!user) {
      await this.recordFailedLogin(email, metadata.ipAddress);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await verifyPassword(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      await this.recordFailedLogin(email, metadata.ipAddress);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.assertUserIsActive(user.status);
    await this.clearFailedLoginAttempts(email, metadata.ipAddress);

    const sessionId = randomUUID();
    const tokenBundle = await this.issueTokenBundle(user.id, sessionId);

    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: hashOpaqueToken(tokenBundle.refreshToken),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        expiresAt: new Date(Date.now() + tokenBundle.refreshTokenExpiresInMs),
        lastUsedAt: new Date(),
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.buildAuthPayload(tokenBundle, sessionId);
  }

  async refresh(refreshToken: string, metadata: RequestMetadata) {
    const payload = await this.verifyRefreshTokenPayload(refreshToken);
    const session = await this.validateRefreshSession(payload, refreshToken);

    const tokenBundle = await this.issueTokenBundle(session.userId, session.id);

    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: {
        tokenHash: hashOpaqueToken(tokenBundle.refreshToken),
        expiresAt: new Date(Date.now() + tokenBundle.refreshTokenExpiresInMs),
        lastUsedAt: new Date(),
        ipAddress: metadata.ipAddress ?? session.ipAddress,
        userAgent: metadata.userAgent ?? session.userAgent,
      },
    });

    return this.buildAuthPayload(tokenBundle, session.id);
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.refreshSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { success: true };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { success: true };
  }

  async getCurrentUser(userId: string, currentSessionId: string) {
    const accessProfile = await this.requireResolvedAccessProfile(userId);

    return {
      user: accessProfile.user,
      permissions: accessProfile.permissions,
      routes: accessProfile.routes,
      sidebarItems: accessProfile.sidebarItems,
      currentSessionId,
    };
  }

  async getRouteContext(request: Request) {
    const accessToken = extractBearerToken(request.headers.authorization);
    const refreshToken = getRefreshTokenFromRequest(request);

    let userId: string | null = null;
    let currentSessionId: string | null = null;

    if (accessToken) {
      try {
        const payload = await this.verifyAccessTokenPayload(accessToken);
        userId = payload.sub;
        currentSessionId = payload.sid;
      } catch {
        userId = null;
        currentSessionId = null;
      }
    }

    if (!userId && refreshToken) {
      try {
        const payload = await this.verifyRefreshTokenPayload(refreshToken);
        const session = await this.validateRefreshSession(
          payload,
          refreshToken,
        );
        userId = session.userId;
        currentSessionId = session.id;
      } catch {
        userId = null;
        currentSessionId = null;
      }
    }

    if (!userId) {
      return {
        authenticated: false,
        pagePermissions: [],
        routes: [],
        sidebarItems: [],
      };
    }

    const accessProfile =
      await this.accessControlService.getResolvedAccessProfile(userId);

    if (!accessProfile || accessProfile.user.status !== UserStatus.ACTIVE) {
      return {
        authenticated: false,
        pagePermissions: [],
        routes: [],
        sidebarItems: [],
      };
    }

    return {
      authenticated: true,
      user: {
        id: accessProfile.user.id,
        email: accessProfile.user.email,
        status: accessProfile.user.status,
        permissionVersion: accessProfile.user.permissionVersion,
        role: accessProfile.user.role,
      },
      pagePermissions: accessProfile.permissions.pages,
      routes: accessProfile.routes,
      sidebarItems: accessProfile.sidebarItems,
      currentSessionId,
    };
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.refreshSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt,
        isCurrent: session.id === currentSessionId,
      })),
    };
  }

  async revokeSession(userId: string, sessionId: string) {
    const revokedSession = await this.prisma.refreshSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (!revokedSession.count) {
      throw new NotFoundException('Session not found');
    }

    return { success: true };
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedRequestUser> {
    const payload = await this.verifyAccessTokenPayload(token);
    const accessProfile = await this.requireResolvedAccessProfile(payload.sub);

    if (payload.ver !== accessProfile.user.permissionVersion) {
      throw new UnauthorizedException('Access token is stale');
    }

    return {
      userId: payload.sub,
      sessionId: payload.sid,
      email: payload.email,
      role: payload.role,
      permissionVersion: payload.ver,
      tokenType: 'access',
    };
  }

  private async issueTokenBundle(
    userId: string,
    sessionId: string,
  ): Promise<TokenBundle> {
    const accessProfile = await this.requireResolvedAccessProfile(userId);

    const accessPayload: AccessTokenPayload = {
      sub: accessProfile.user.id,
      sid: sessionId,
      email: accessProfile.user.email,
      role: accessProfile.user.role.key,
      ver: accessProfile.user.permissionVersion,
      type: 'access',
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: accessProfile.user.id,
      sid: sessionId,
      ver: accessProfile.user.permissionVersion,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: getAccessTokenSecret(),
        expiresIn: getAccessTokenExpiresInSeconds(),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: getRefreshTokenSecret(),
        expiresIn: Math.floor(getRefreshTokenExpiresInMs() / 1000),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: getAccessTokenExpiresInSeconds(),
      refreshTokenExpiresInMs: getRefreshTokenExpiresInMs(),
      accessProfile,
    };
  }

  private buildAuthPayload(tokenBundle: TokenBundle, currentSessionId: string) {
    return {
      accessToken: tokenBundle.accessToken,
      refreshToken: tokenBundle.refreshToken,
      accessTokenExpiresIn: tokenBundle.accessTokenExpiresIn,
      user: tokenBundle.accessProfile.user,
      permissions: tokenBundle.accessProfile.permissions,
      routes: tokenBundle.accessProfile.routes,
      sidebarItems: tokenBundle.accessProfile.sidebarItems,
      currentSessionId,
    };
  }

  private async requireResolvedAccessProfile(
    userId: string,
  ): Promise<ResolvedAccessProfile> {
    const accessProfile =
      await this.accessControlService.getResolvedAccessProfile(userId);

    if (!accessProfile) {
      throw new UnauthorizedException('User not found');
    }

    this.assertUserIsActive(accessProfile.user.status);
    return accessProfile;
  }

  private async verifyAccessTokenPayload(
    token: string,
  ): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: getAccessTokenSecret(),
        },
      );

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid access token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private async verifyRefreshTokenPayload(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        token,
        {
          secret: getRefreshTokenSecret(),
        },
      );

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async validateRefreshSession(
    payload: RefreshTokenPayload,
    refreshToken: string,
  ): Promise<RefreshSession> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: payload.sid },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh session not found');
    }

    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh session expired');
    }

    if (session.tokenHash !== hashOpaqueToken(refreshToken)) {
      await this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      throw new UnauthorizedException('Refresh session invalid');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: { status: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.assertUserIsActive(user.status);
    return session;
  }

  private assertUserIsActive(status: UserStatus): void {
    if (status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Account suspended');
    }

    if (status === UserStatus.BANNED) {
      throw new ForbiddenException('Account banned');
    }
  }

  private async throwIfLoginRateLimited(
    email: string,
    ipAddress: string | null,
  ): Promise<void> {
    const conditions: Prisma.LoginAttemptWhereInput[] = [{ email }];

    if (ipAddress) {
      conditions.push({ ipAddress });
    }

    const attempts = await this.prisma.loginAttempt.findMany({
      where: { OR: conditions },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const isLocked = attempts.some(
      (attempt) =>
        Boolean(attempt.lockedUntil) &&
        attempt.lockedUntil!.getTime() > Date.now(),
    );

    if (isLocked) {
      throw new HttpException(
        'Too many failed login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordFailedLogin(
    email: string,
    ipAddress: string | null,
  ): Promise<void> {
    const latestAttempt = await this.prisma.loginAttempt.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const shouldResetWindow =
      !latestAttempt ||
      now.getTime() - latestAttempt.windowStartedAt.getTime() >
        AUTH_LOGIN_ATTEMPT_WINDOW_MS;

    if (shouldResetWindow) {
      await this.prisma.loginAttempt.create({
        data: {
          email,
          ipAddress,
          attemptCount: 1,
          windowStartedAt: now,
        },
      });

      return;
    }

    const nextAttemptCount = latestAttempt.attemptCount + 1;
    await this.prisma.loginAttempt.update({
      where: { id: latestAttempt.id },
      data: {
        ipAddress,
        attemptCount: nextAttemptCount,
        lockedUntil:
          nextAttemptCount >= AUTH_MAX_FAILED_ATTEMPTS
            ? new Date(now.getTime() + AUTH_LOGIN_LOCK_MS)
            : latestAttempt.lockedUntil,
      },
    });
  }

  private async clearFailedLoginAttempts(
    email: string,
    ipAddress: string | null,
  ): Promise<void> {
    const conditions: Prisma.LoginAttemptWhereInput[] = [{ email }];

    if (ipAddress) {
      conditions.push({ ipAddress });
    }

    await this.prisma.loginAttempt.deleteMany({
      where: { OR: conditions },
    });
  }
}
