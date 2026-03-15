import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { ROUTE_SCOPE_KEY } from '../common.constants';
import type { RequestScope } from '../common.types';
import type { AuthenticatedRequest } from '../../auth/auth.types';

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scope = this.reflector.getAllAndOverride<RequestScope>(
      ROUTE_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!scope || scope === 'global') {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authUser = request.authUser;

    if (!authUser) {
      throw new UnauthorizedException('Authentication required');
    }

    if (authUser.role === 'admin') {
      return true;
    }

    const targetUserId = this.extractTargetUserId(request.params);

    if (!targetUserId) {
      throw new ForbiddenException('Target user scope missing');
    }

    if (scope === 'self') {
      return authUser.userId === targetUserId;
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, managerId: true },
    });

    if (!targetUser) {
      throw new ForbiddenException('Target user not found');
    }

    if (scope === 'team') {
      return targetUser.managerId === authUser.userId;
    }

    return (
      targetUser.id === authUser.userId ||
      targetUser.managerId === authUser.userId
    );
  }

  private extractTargetUserId(
    params: Record<string, string | string[] | undefined>,
  ): string | null {
    const rawValue = params.id ?? params.userId ?? params.targetUserId;

    if (Array.isArray(rawValue)) {
      return rawValue[0] ?? null;
    }

    return rawValue ?? null;
  }
}
