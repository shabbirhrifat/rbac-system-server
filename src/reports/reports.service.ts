import { Injectable } from '@nestjs/common';
import { ActorContextService } from '../common/services/actor-context.service';
import { PrismaService } from '../database/prisma.service';
import { ReportsQueryDto } from './dto/reports-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService,
  ) {}

  async getOverview(actorUserId: string, query: ReportsQueryDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const dateFilter = this.buildDateFilter(query);

    const [usersByStatus, usersByRole, leadsByStatus, tasksByStatus] =
      await Promise.all([
        this.prisma.user.groupBy({
          by: ['status'],
          where: {
            ...this.actorContextService.buildUserScopeWhere(actor),
            createdAt: dateFilter,
          },
          _count: { _all: true },
        }),
        this.prisma.user.groupBy({
          by: ['roleId'],
          where: {
            ...this.actorContextService.buildUserScopeWhere(actor),
            createdAt: dateFilter,
          },
          _count: { _all: true },
        }),
        this.prisma.lead.groupBy({
          by: ['status'],
          where: {
            ...this.actorContextService.buildLeadScopeWhere(actor),
            createdAt: dateFilter,
          },
          _count: { _all: true },
        }),
        this.prisma.task.groupBy({
          by: ['status'],
          where: {
            ...this.actorContextService.buildTaskScopeWhere(actor),
            createdAt: dateFilter,
          },
          _count: { _all: true },
        }),
      ]);

    const roles = await this.prisma.role.findMany({
      select: { id: true, key: true, name: true },
    });
    const roleMap = new Map(roles.map((role) => [role.id, role]));

    return {
      usersByStatus,
      usersByRole: usersByRole.map((entry) => ({
        roleId: entry.roleId,
        roleKey: roleMap.get(entry.roleId)?.key ?? null,
        roleName: roleMap.get(entry.roleId)?.name ?? null,
        count: entry._count._all,
      })),
      leadsByStatus,
      tasksByStatus,
    };
  }

  async getUsersReport(actorUserId: string, query: ReportsQueryDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const dateFilter = this.buildDateFilter(query);

    const [usersByRole, usersByStatus] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['roleId'],
        where: {
          ...this.actorContextService.buildUserScopeWhere(actor),
          createdAt: dateFilter,
        },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ['status'],
        where: {
          ...this.actorContextService.buildUserScopeWhere(actor),
          createdAt: dateFilter,
        },
        _count: { _all: true },
      }),
    ]);

    return {
      usersByRole,
      usersByStatus,
    };
  }

  async getLeadsReport(actorUserId: string, query: ReportsQueryDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const dateFilter = this.buildDateFilter(query);

    const [leadsByStatus, leadsByAssignee] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status'],
        where: {
          ...this.actorContextService.buildLeadScopeWhere(actor),
          createdAt: dateFilter,
        },
        _count: { _all: true },
      }),
      this.prisma.lead.groupBy({
        by: ['assignedToUserId'],
        where: {
          ...this.actorContextService.buildLeadScopeWhere(actor),
          createdAt: dateFilter,
        },
        _count: { _all: true },
      }),
    ]);

    return {
      leadsByStatus,
      leadsByAssignee,
    };
  }

  async getTasksReport(actorUserId: string, query: ReportsQueryDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const dateFilter = this.buildDateFilter(query);

    const [tasksByStatus, tasksByPriority, overdueTasks] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: {
          ...this.actorContextService.buildTaskScopeWhere(actor),
          createdAt: dateFilter,
        },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['priority'],
        where: {
          ...this.actorContextService.buildTaskScopeWhere(actor),
          createdAt: dateFilter,
        },
        _count: { _all: true },
      }),
      this.prisma.task.count({
        where: {
          ...this.actorContextService.buildTaskScopeWhere(actor),
          dueAt: { lt: new Date() },
          status: {
            not: 'DONE',
          },
        },
      }),
    ]);

    return {
      tasksByStatus,
      tasksByPriority,
      overdueTasks,
    };
  }

  private buildDateFilter(query: ReportsQueryDto) {
    if (!query.from && !query.to) {
      return undefined;
    }

    return {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }
}
