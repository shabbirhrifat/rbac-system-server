import { Injectable } from '@nestjs/common';
import { ActorContextService } from '../common/services/actor-context.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService,
  ) {}

  async getSummary(actorUserId: string) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const [users, leads, tasks, recentAuditCount] = await Promise.all([
      this.prisma.user.count({
        where: this.actorContextService.buildUserScopeWhere(actor),
      }),
      this.prisma.lead.count({
        where: this.actorContextService.buildLeadScopeWhere(actor),
      }),
      this.prisma.task.count({
        where: this.actorContextService.buildTaskScopeWhere(actor),
      }),
      this.prisma.auditLog.count({
        where: this.buildAuditWhere(actorUserId, actor.role.key),
      }),
    ]);

    const [pendingTasks, activeLeads] = await Promise.all([
      this.prisma.task.count({
        where: {
          ...this.actorContextService.buildTaskScopeWhere(actor),
          status: {
            in: ['TODO', 'IN_PROGRESS'],
          },
        },
      }),
      this.prisma.lead.count({
        where: {
          ...this.actorContextService.buildLeadScopeWhere(actor),
          status: {
            in: ['NEW', 'CONTACTED', 'QUALIFIED'],
          },
        },
      }),
    ]);

    return {
      counts: {
        users,
        leads,
        tasks,
        recentAuditCount,
      },
      highlights: {
        pendingTasks,
        activeLeads,
      },
    };
  }

  async getActivity(actorUserId: string) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const activities = await this.prisma.auditLog.findMany({
      where: this.buildAuditWhere(actorUserId, actor.role.key),
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        module: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actorUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      items: activities,
    };
  }

  private buildAuditWhere(actorUserId: string, roleKey: string) {
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
}
