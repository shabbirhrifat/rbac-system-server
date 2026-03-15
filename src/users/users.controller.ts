import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentAuthUser } from '../auth/decorators/current-auth-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RouteScope } from '../common/decorators/route-scope.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users.read')
  listUsers(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Query() query: ListUsersQueryDto,
  ) {
    return this.usersService.listUsers(authUser.userId, query);
  }

  @Post()
  @RequirePermissions('users.create')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({
    module: 'users',
    action: 'create',
    entityType: 'user',
  })
  createUser(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.createUser(authUser.userId, dto);
  }

  @Get(':id')
  @UseGuards(ScopeGuard)
  @RequirePermissions('users.read')
  @RouteScope('team_or_self')
  getUser(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) userId: string,
  ) {
    return this.usersService.getUser(authUser.userId, userId);
  }

  @Patch(':id')
  @UseGuards(ScopeGuard)
  @RequirePermissions('users.update')
  @RouteScope('team_or_self')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({
    module: 'users',
    action: 'update',
    entityType: 'user',
    entityIdParam: 'id',
    targetUserParam: 'id',
  })
  updateUser(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(authUser.userId, userId, dto);
  }

  @Patch(':id/status')
  @UseGuards(ScopeGuard)
  @RequireAnyPermissions('users.suspend', 'users.ban')
  @RouteScope('team_or_self')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({
    module: 'users',
    action: 'status.update',
    entityType: 'user',
    entityIdParam: 'id',
    targetUserParam: 'id',
  })
  updateUserStatus(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateUserStatus(authUser.userId, userId, dto);
  }

  @Patch(':id/manager')
  @UseGuards(ScopeGuard)
  @RequirePermissions('users.assign_manager')
  @RouteScope('team_or_self')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({
    module: 'users',
    action: 'manager.assign',
    entityType: 'user',
    entityIdParam: 'id',
    targetUserParam: 'id',
  })
  assignManager(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() dto: AssignManagerDto,
  ) {
    return this.usersService.assignManager(authUser.userId, userId, dto);
  }

  @Get(':id/activity')
  @UseGuards(ScopeGuard)
  @RequirePermissions('users.read')
  @RouteScope('team_or_self')
  getUserActivity(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) userId: string,
  ) {
    return this.usersService.getUserActivity(authUser.userId, userId);
  }
}
