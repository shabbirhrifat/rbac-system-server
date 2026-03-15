import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentAuthUser } from '../auth/decorators/current-auth-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';
import { UpdateProfileSettingsDto } from './dto/update-profile-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('profile')
  @RequirePermissions('settings.read_self')
  getProfileSettings(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.settingsService.getProfileSettings(authUser.userId);
  }

  @Patch('profile')
  @RequirePermissions('settings.update_self')
  updateProfileSettings(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Body() dto: UpdateProfileSettingsDto,
  ) {
    return this.settingsService.updateProfileSettings(authUser.userId, dto);
  }

  @Get('app')
  @RequirePermissions('settings.read_app')
  getAppSettings(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.settingsService.getAppSettings(authUser.userId);
  }

  @Patch('app/:key')
  @RequirePermissions('settings.update_app')
  updateAppSettings(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('key') key: string,
    @Body() dto: UpdateAppSettingsDto,
  ) {
    return this.settingsService.updateAppSettings(authUser.userId, key, dto);
  }
}
