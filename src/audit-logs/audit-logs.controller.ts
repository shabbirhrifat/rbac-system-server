import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuthUser } from '../auth/decorators/current-auth-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AuditLogsService } from './audit-logs.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@Controller('audit-logs')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @RequirePermissions('audit.read')
  listAuditLogs(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Query() query: ListAuditLogsQueryDto,
  ) {
    return this.auditLogsService.listAuditLogs(authUser.userId, query);
  }

  @Get(':id')
  @RequirePermissions('audit.read')
  getAuditLog(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) auditLogId: string,
  ) {
    return this.auditLogsService.getAuditLog(authUser.userId, auditLogId);
  }
}
