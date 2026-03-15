import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';
import { ActorContextService } from '../common/services/actor-context.service';
import { PrismaService } from '../database/prisma.service';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService,
  ) {}

  async listLeads(actorUserId: string, query: ListLeadsQueryDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const orderBy = this.buildLeadOrderBy(query.sortBy, query.sortOrder);

    const where: Prisma.LeadWhereInput = {
      AND: [
        this.actorContextService.buildLeadScopeWhere(actor),
        query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
                { company: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {},
        query.status ? { status: this.parseLeadStatus(query.status) } : {},
        query.assignedToUserId
          ? { assignedToUserId: query.assignedToUserId }
          : {},
        query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {},
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: this.leadSelect,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async createLead(actorUserId: string, dto: CreateLeadDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const managerId = this.actorContextService.getManagedManagerId(actor);

    if (!managerId && actor.role.key !== 'admin') {
      throw new ForbiddenException('Lead creation requires manager scope');
    }

    await this.assertAssigneeInScope(actor, dto.assignedToUserId);
    await this.assertCustomerInScope(actor, dto.customerId);

    return this.prisma.lead.create({
      data: {
        name: dto.name.trim(),
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        company: dto.company?.trim() || null,
        source: dto.source?.trim() || null,
        notes: dto.notes?.trim() || null,
        managerId: managerId ?? actorUserId,
        assignedToUserId: dto.assignedToUserId ?? null,
        customerId: dto.customerId ?? null,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      },
      select: this.leadSelect,
    });
  }

  async getLead(actorUserId: string, leadId: string) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        ...this.actorContextService.buildLeadScopeWhere(actor),
      },
      select: this.leadSelect,
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  async updateLead(actorUserId: string, leadId: string, dto: UpdateLeadDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    await this.ensureLeadInScope(actor, leadId);
    await this.assertCustomerInScope(actor, dto.customerId);

    return this.prisma.lead.update({
      where: { id: leadId },
      data: {
        name: dto.name?.trim(),
        email: dto.email?.trim() || undefined,
        phone: dto.phone?.trim() || undefined,
        company: dto.company?.trim() || undefined,
        source: dto.source?.trim() || undefined,
        notes: dto.notes?.trim() || undefined,
        customerId: dto.customerId ?? undefined,
        updatedBy: actorUserId,
      },
      select: this.leadSelect,
    });
  }

  async updateLeadStatus(
    actorUserId: string,
    leadId: string,
    dto: UpdateLeadStatusDto,
  ) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    await this.ensureLeadInScope(actor, leadId);

    return this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status: this.parseLeadStatus(dto.status),
        updatedBy: actorUserId,
      },
      select: this.leadSelect,
    });
  }

  async assignLead(actorUserId: string, leadId: string, dto: AssignLeadDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    await this.ensureLeadInScope(actor, leadId);
    await this.assertAssigneeInScope(actor, dto.assignedToUserId);

    return this.prisma.lead.update({
      where: { id: leadId },
      data: {
        assignedToUserId: dto.assignedToUserId ?? null,
        updatedBy: actorUserId,
      },
      select: this.leadSelect,
    });
  }

  async deleteLead(actorUserId: string, leadId: string) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    await this.ensureLeadInScope(actor, leadId);

    return this.prisma.lead.update({
      where: { id: leadId },
      data: {
        deletedAt: new Date(),
        updatedBy: actorUserId,
      },
      select: this.leadSelect,
    });
  }

  private async ensureLeadInScope(
    actor: Awaited<ReturnType<ActorContextService['getActorOrThrow']>>,
    leadId: string,
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        ...this.actorContextService.buildLeadScopeWhere(actor),
      },
      select: { id: true },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
  }

  private async assertAssigneeInScope(
    actor: Awaited<ReturnType<ActorContextService['getActorOrThrow']>>,
    assignedToUserId?: string,
  ) {
    if (!assignedToUserId) {
      return;
    }

    const assignee = await this.prisma.user.findUnique({
      where: { id: assignedToUserId },
      select: { id: true, managerId: true, role: { select: { key: true } } },
    });

    if (!assignee) {
      throw new NotFoundException('Assigned user not found');
    }

    if (actor.role.key === 'admin') {
      return;
    }

    if (actor.role.key === 'manager') {
      if (assignee.managerId !== actor.id || assignee.role.key !== 'agent') {
        throw new ForbiddenException('Assignee outside manager scope');
      }

      return;
    }

    if (assignee.id !== actor.id) {
      throw new ForbiddenException('Assignee outside self scope');
    }
  }

  private async assertCustomerInScope(
    actor: Awaited<ReturnType<ActorContextService['getActorOrThrow']>>,
    customerId?: string,
  ) {
    if (!customerId) {
      return;
    }

    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, managerId: true, role: { select: { key: true } } },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.role.key !== 'customer') {
      throw new BadRequestException('Selected user must be a customer');
    }

    if (actor.role.key === 'admin') {
      return;
    }

    if (customer.managerId !== actor.id && customer.id !== actor.id) {
      throw new ForbiddenException('Customer outside actor scope');
    }
  }

  private parseLeadStatus(status: string): LeadStatus {
    const normalized = status.trim().toLowerCase();

    switch (normalized) {
      case 'new':
        return LeadStatus.NEW;
      case 'contacted':
        return LeadStatus.CONTACTED;
      case 'qualified':
        return LeadStatus.QUALIFIED;
      case 'won':
        return LeadStatus.WON;
      case 'lost':
        return LeadStatus.LOST;
      default:
        throw new BadRequestException('Unsupported lead status');
    }
  }

  private buildLeadOrderBy(
    sortBy?: string,
    sortOrder?: string,
  ): Prisma.LeadOrderByWithRelationInput[] {
    const direction = this.normalizeSortOrder(sortOrder);

    switch (sortBy) {
      case 'name':
        return [{ name: direction }];
      case 'company':
        return [{ company: direction }];
      case 'status':
        return [{ status: direction }];
      case 'updatedAt':
        return [{ updatedAt: direction }];
      case 'createdAt':
        return [{ createdAt: direction }];
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  private normalizeSortOrder(sortOrder?: string): Prisma.SortOrder {
    return sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
  }

  private readonly leadSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    company: true,
    source: true,
    status: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
    manager: {
      select: { id: true, email: true, firstName: true, lastName: true },
    },
    assignedToUser: {
      select: { id: true, email: true, firstName: true, lastName: true },
    },
    customer: {
      select: { id: true, email: true, firstName: true, lastName: true },
    },
  } satisfies Prisma.LeadSelect;
}
