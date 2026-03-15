import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentAuthUser } from '../auth/decorators/current-auth-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RouteScope } from '../common/decorators/route-scope.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { ReplaceUserOverridesDto } from './dto/replace-user-overrides.dto';
import { AccessControlService } from './access-control.service';

@Controller('access')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Get('catalog')
  @RequirePermissions('permissions.read')
  getPermissionCatalog() {
    return this.accessControlService.getPermissionCatalog();
  }

  @Get('grantable')
  @RequirePermissions('permissions.read')
  getGrantablePermissions(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
  ) {
    return this.accessControlService.getGrantablePermissions(authUser.userId);
  }

  @Get('roles')
  @RequirePermissions('permissions.read')
  getRoles() {
    return this.accessControlService.getRoles();
  }

  @Get('users/:id')
  @UseGuards(ScopeGuard)
  @RequirePermissions('permissions.read')
  @RouteScope('team_or_self')
  getUserAccess(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) userId: string,
  ) {
    return this.accessControlService.getUserAccess(authUser.userId, userId);
  }

  @Put('users/:id')
  @UseGuards(ScopeGuard)
  @RequirePermissions('permissions.assign')
  @RouteScope('team_or_self')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({
    module: 'permissions',
    action: 'override.replace',
    entityType: 'user_permission',
    entityIdParam: 'id',
    targetUserParam: 'id',
  })
  replaceUserOverrides(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() dto: ReplaceUserOverridesDto,
  ) {
    return this.accessControlService.replaceUserOverrides(
      authUser.userId,
      userId,
      dto.overrides,
    );
  }
}
