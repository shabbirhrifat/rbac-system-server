import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentAuthUser } from '../auth/decorators/current-auth-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { CustomerPortalService } from './customer-portal.service';
import { UpdatePortalProfileDto } from './dto/update-portal-profile.dto';

@Controller('portal')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class CustomerPortalController {
  constructor(private readonly customerPortalService: CustomerPortalService) {}

  @Get('overview')
  @RequirePermissions('portal.read_self')
  getOverview(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.customerPortalService.getOverview(authUser.userId);
  }

  @Get('profile')
  @RequirePermissions('portal.read_self')
  getProfile(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.customerPortalService.getProfile(authUser.userId);
  }

  @Patch('profile')
  @RequirePermissions('portal.update_self')
  updateProfile(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Body() dto: UpdatePortalProfileDto,
  ) {
    return this.customerPortalService.updateProfile(authUser.userId, dto);
  }

  @Get('tasks')
  @RequirePermissions('portal.read_self')
  getTasks(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.customerPortalService.getTasks(authUser.userId);
  }

  @Get('activity')
  @RequirePermissions('portal.read_self')
  getActivity(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.customerPortalService.getActivity(authUser.userId);
  }
}
