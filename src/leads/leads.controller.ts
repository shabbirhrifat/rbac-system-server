import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentAuthUser } from '../auth/decorators/current-auth-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @RequirePermissions('leads.read')
  listLeads(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Query() query: ListLeadsQueryDto,
  ) {
    return this.leadsService.listLeads(authUser.userId, query);
  }

  @Post()
  @RequirePermissions('leads.create')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({ module: 'leads', action: 'create', entityType: 'lead' })
  createLead(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leadsService.createLead(authUser.userId, dto);
  }

  @Get(':id')
  @RequirePermissions('leads.read')
  getLead(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) leadId: string,
  ) {
    return this.leadsService.getLead(authUser.userId, leadId);
  }

  @Patch(':id')
  @RequirePermissions('leads.update')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({
    module: 'leads',
    action: 'update',
    entityType: 'lead',
    entityIdParam: 'id',
  })
  updateLead(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) leadId: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.updateLead(authUser.userId, leadId, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('leads.change_status')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({
    module: 'leads',
    action: 'status.update',
    entityType: 'lead',
    entityIdParam: 'id',
  })
  updateLeadStatus(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) leadId: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.leadsService.updateLeadStatus(authUser.userId, leadId, dto);
  }

  @Patch(':id/assign')
  @RequirePermissions('leads.assign')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({
    module: 'leads',
    action: 'assign',
    entityType: 'lead',
    entityIdParam: 'id',
  })
  assignLead(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) leadId: string,
    @Body() dto: AssignLeadDto,
  ) {
    return this.leadsService.assignLead(authUser.userId, leadId, dto);
  }

  @Delete(':id')
  @RequirePermissions('leads.delete')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({
    module: 'leads',
    action: 'delete',
    entityType: 'lead',
    entityIdParam: 'id',
  })
  deleteLead(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) leadId: string,
  ) {
    return this.leadsService.deleteLead(authUser.userId, leadId);
  }
}
