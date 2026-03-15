import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdatePortalProfileDto } from './dto/update-portal-profile.dto';

@Injectable()
export class CustomerPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string) {
    const [profile, tasks, leads, recentActivity] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          status: true,
          createdAt: true,
          userSetting: {
            select: {
              timezone: true,
              locale: true,
              sidebarCollapsed: true,
            },
          },
        },
      }),
      this.prisma.task.count({
        where: {
          customerId: userId,
          deletedAt: null,
        },
      }),
      this.prisma.lead.count({
        where: {
          customerId: userId,
          deletedAt: null,
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          OR: [{ actorUserId: userId }, { targetUserId: userId }],
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          module: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      profile,
      counts: {
        tasks,
        leads,
      },
      recentActivity,
    };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        userSetting: {
          select: {
            timezone: true,
            locale: true,
            sidebarCollapsed: true,
          },
        },
      },
    });
  }

  async updateProfile(userId: string, dto: UpdatePortalProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        phone: dto.phone?.trim() || undefined,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async getTasks(userId: string) {
    const items = await this.prisma.task.findMany({
      where: {
        customerId: userId,
        deletedAt: null,
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueAt: true,
        completedAt: true,
        createdAt: true,
        assignedToUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    return { items };
  }

  async getActivity(userId: string) {
    const items = await this.prisma.auditLog.findMany({
      where: {
        OR: [{ actorUserId: userId }, { targetUserId: userId }],
      },
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
      },
    });

    return { items };
  }
}
