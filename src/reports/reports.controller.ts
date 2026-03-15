import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentAuthUser } from '../auth/decorators/current-auth-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @RequirePermissions('reports.read')
  getOverview(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Query() query: ReportsQueryDto,
  ) {
    return this.reportsService.getOverview(authUser.userId, query);
  }

  @Get('users')
  @RequirePermissions('reports.read')
  getUsersReport(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Query() query: ReportsQueryDto,
  ) {
    return this.reportsService.getUsersReport(authUser.userId, query);
  }

  @Get('leads')
  @RequirePermissions('reports.read')
  getLeadsReport(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Query() query: ReportsQueryDto,
  ) {
    return this.reportsService.getLeadsReport(authUser.userId, query);
  }

  @Get('tasks')
  @RequirePermissions('reports.read')
  getTasksReport(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Query() query: ReportsQueryDto,
  ) {
    return this.reportsService.getTasksReport(authUser.userId, query);
  }
}
