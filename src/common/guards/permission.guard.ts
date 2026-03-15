import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessControlService } from '../../access-control/access-control.service';
import { REQUIRED_PERMISSIONS_KEY } from '../common.constants';
import type { AuthenticatedRequest } from '../../auth/auth.types';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessControlService: AccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.authUser) {
      throw new UnauthorizedException('Authentication required');
    }

    const accessProfile = await this.accessControlService.getResolvedAccessProfile(
      request.authUser.userId,
    );

    if (!accessProfile) {
      throw new UnauthorizedException('User access profile not found');
    }

    return requiredPermissions.every((permission) =>
      accessProfile.permissions.all.includes(permission),
    );
  }
}
