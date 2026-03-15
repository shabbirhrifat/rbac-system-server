import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentAuthUser } from '../auth/decorators/current-auth-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @RequirePermissions('page.dashboard.view')
  getSummary(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.dashboardService.getSummary(authUser.userId);
  }

  @Get('activity')
  @RequirePermissions('page.dashboard.view')
  getActivity(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.dashboardService.getActivity(authUser.userId);
  }
}
