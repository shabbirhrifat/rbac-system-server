import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActorContextService } from '../common/services/actor-context.service';
import { PrismaService } from '../database/prisma.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService,
  ) {}

  async listAuditLogs(actorUserId: string, query: ListAuditLogsQueryDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const orderBy = this.buildAuditOrderBy(query.sortBy, query.sortOrder);

    const where: Prisma.AuditLogWhereInput = {
      AND: [
        this.buildScopeWhere(actorUserId, actor.role.key),
        query.module ? { module: query.module.trim() } : {},
        query.action ? { action: query.action.trim() } : {},
        query.actorUserId ? { actorUserId: query.actorUserId } : {},
        query.targetUserId ? { targetUserId: query.targetUserId } : {},
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
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: this.auditSelect,
      }),
      this.prisma.auditLog.count({ where }),
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

  async getAuditLog(actorUserId: string, auditLogId: string) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const auditLog = await this.prisma.auditLog.findFirst({
      where: {
        id: auditLogId,
        ...this.buildScopeWhere(actorUserId, actor.role.key),
      },
      select: this.auditSelect,
    });

    if (!auditLog) {
      throw new NotFoundException('Audit log not found');
    }

    return auditLog;
  }

  private buildScopeWhere(actorUserId: string, roleKey: string) {
    if (roleKey === 'admin') {
      return {};
    }

    if (roleKey === 'manager') {
      return {
        OR: [{ actorUserId }, { targetUser: { managerId: actorUserId } }],
      };
    }

    return {
      OR: [{ actorUserId }, { targetUserId: actorUserId }],
    };
  }

  private buildAuditOrderBy(
    sortBy?: string,
    sortOrder?: string,
  ): Prisma.AuditLogOrderByWithRelationInput[] {
    const direction = sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    switch (sortBy) {
      case 'module':
        return [{ module: direction }, { createdAt: 'desc' }];
      case 'action':
        return [{ action: direction }, { createdAt: 'desc' }];
      case 'createdAt':
        return [{ createdAt: direction }];
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  private readonly auditSelect = {
    id: true,
    module: true,
    action: true,
    entityType: true,
    entityId: true,
    metadata: true,
    ipAddress: true,
    userAgent: true,
    createdAt: true,
    actorUser: {
      select: { id: true, email: true, firstName: true, lastName: true },
    },
    targetUser: {
      select: { id: true, email: true, firstName: true, lastName: true },
    },
  } satisfies Prisma.AuditLogSelect;
}
