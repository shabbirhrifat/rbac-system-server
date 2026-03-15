import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { hashPassword } from '../auth/utils/password.util';
import { ActorContextService } from '../common/services/actor-context.service';
import { PrismaService } from '../database/prisma.service';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService,
  ) {}

  async listUsers(actorUserId: string, query: ListUsersQueryDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const orderBy = this.buildUserOrderBy(query.sortBy, query.sortOrder);

    const where: Prisma.UserWhereInput = {
      AND: [
        this.actorContextService.buildUserScopeWhere(actor),
        query.search
          ? {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {},
        query.status ? { status: this.parseUserStatus(query.status) } : {},
        query.role ? { role: { key: query.role.trim().toLowerCase() } } : {},
        query.managerId ? { managerId: query.managerId } : {},
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
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: this.userListSelect,
      }),
      this.prisma.user.count({ where }),
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

  async createUser(actorUserId: string, dto: CreateUserDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const roleKey = dto.roleKey.trim().toLowerCase();
    this.actorContextService.assertCanAssignRole(actor, roleKey);

    const role = await this.findRoleByKey(roleKey);
    const managerId = await this.resolveManagerIdForCreate(
      actorUserId,
      actor,
      dto,
    );
    const passwordHash = await hashPassword(dto.password);

    const createdUser = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone?.trim() || null,
        roleId: role.id,
        managerId,
        createdBy: actorUserId,
        status: dto.status
          ? this.parseUserStatus(dto.status)
          : UserStatus.ACTIVE,
        userSetting: {
          create: {
            locale: 'en',
            timezone: 'UTC',
          },
        },
      },
      select: this.userDetailSelect,
    });

    return createdUser;
  }

  async getUser(actorUserId: string, userId: string) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.userDetailSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.actorContextService.assertCanAccessUser(actor, user);
    return user;
  }

  async updateUser(actorUserId: string, userId: string, dto: UpdateUserDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const existingUser = await this.requireUserRecord(userId);

    this.actorContextService.assertCanAccessUser(actor, existingUser);

    let roleId: string | undefined;
    if (dto.roleKey) {
      const roleKey = dto.roleKey.trim().toLowerCase();
      this.actorContextService.assertCanAssignRole(actor, roleKey);
      roleId = (await this.findRoleByKey(roleKey)).id;
    }

    const managerId = await this.resolveManagerIdForUpdate(
      actorUserId,
      actor,
      existingUser.id,
      dto,
    );

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email,
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        phone: dto.phone?.trim() || undefined,
        roleId,
        managerId,
      },
      select: this.userDetailSelect,
    });

    return updatedUser;
  }

  async updateUserStatus(
    actorUserId: string,
    userId: string,
    dto: UpdateUserStatusDto,
  ) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const existingUser = await this.requireUserRecord(userId);
    this.actorContextService.assertCanAccessUser(actor, existingUser);

    const nextStatus = this.parseUserStatus(dto.status);
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: nextStatus,
        suspendedAt: nextStatus === UserStatus.SUSPENDED ? new Date() : null,
        bannedAt: nextStatus === UserStatus.BANNED ? new Date() : null,
      },
      select: this.userDetailSelect,
    });

    return updatedUser;
  }

  async assignManager(
    actorUserId: string,
    userId: string,
    dto: AssignManagerDto,
  ) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const existingUser = await this.requireUserRecord(userId);
    this.actorContextService.assertCanAccessUser(actor, existingUser);

    if (existingUser.id === actorUserId && dto.managerId) {
      throw new BadRequestException('You cannot reassign your own manager');
    }

    if (dto.managerId) {
      const manager = await this.requireUserRecord(dto.managerId);
      this.actorContextService.assertCanAccessUser(actor, manager);

      if (manager.role.key !== 'manager') {
        throw new BadRequestException('Assigned user must have manager role');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { managerId: dto.managerId ?? null },
      select: this.userDetailSelect,
    });
  }

  async getUserActivity(actorUserId: string, userId: string) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const user = await this.requireUserRecord(userId);
    this.actorContextService.assertCanAccessUser(actor, user);

    const activities = await this.prisma.auditLog.findMany({
      where: {
        OR: [{ actorUserId: userId }, { targetUserId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
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

  private async resolveManagerIdForCreate(
    actorUserId: string,
    actor: Awaited<ReturnType<ActorContextService['getActorOrThrow']>>,
    dto: CreateUserDto,
  ): Promise<string | null> {
    const targetRoleKey = dto.roleKey.trim().toLowerCase();

    if (targetRoleKey === 'admin') {
      return null;
    }

    if (targetRoleKey === 'manager') {
      if (!this.actorContextService.isAdmin(actor)) {
        throw new ForbiddenException('Only admin can create manager users');
      }

      return null;
    }

    if (this.actorContextService.isManager(actor)) {
      return actorUserId;
    }

    if (dto.managerId) {
      const manager = await this.requireUserRecord(dto.managerId);
      if (manager.role.key !== 'manager') {
        throw new BadRequestException(
          'Assigned manager must have manager role',
        );
      }

      return manager.id;
    }

    if (targetRoleKey === 'agent' || targetRoleKey === 'customer') {
      throw new BadRequestException(
        'managerId is required for agent and customer',
      );
    }

    return null;
  }

  private async resolveManagerIdForUpdate(
    actorUserId: string,
    actor: Awaited<ReturnType<ActorContextService['getActorOrThrow']>>,
    userId: string,
    dto: UpdateUserDto,
  ): Promise<string | null | undefined> {
    if (dto.managerId === undefined) {
      return undefined;
    }

    if (dto.managerId === userId) {
      throw new BadRequestException('User cannot be their own manager');
    }

    if (!dto.managerId) {
      return null;
    }

    const manager = await this.requireUserRecord(dto.managerId);
    this.actorContextService.assertCanAccessUser(actor, manager);

    if (manager.role.key !== 'manager') {
      throw new BadRequestException('Assigned manager must have manager role');
    }

    if (
      this.actorContextService.isManager(actor) &&
      manager.id !== actorUserId
    ) {
      throw new ForbiddenException(
        'Managers can only assign themselves as manager',
      );
    }

    return manager.id;
  }

  private async findRoleByKey(roleKey: string) {
    const role = await this.prisma.role.findUnique({
      where: { key: roleKey },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  private async requireUserRecord(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        managerId: true,
        role: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private parseUserStatus(status: string): UserStatus {
    const normalized = status.trim().toLowerCase();

    switch (normalized) {
      case 'active':
        return UserStatus.ACTIVE;
      case 'suspended':
        return UserStatus.SUSPENDED;
      case 'banned':
        return UserStatus.BANNED;
      default:
        throw new BadRequestException('Unsupported user status');
    }
  }

  private buildUserOrderBy(
    sortBy?: string,
    sortOrder?: string,
  ): Prisma.UserOrderByWithRelationInput[] {
    const direction = this.normalizeSortOrder(sortOrder);

    switch (sortBy) {
      case 'firstName':
        return [{ firstName: direction }];
      case 'lastName':
        return [{ lastName: direction }];
      case 'email':
        return [{ email: direction }];
      case 'status':
        return [{ status: direction }];
      case 'lastLoginAt':
        return [{ lastLoginAt: direction }, { createdAt: 'desc' }];
      case 'createdAt':
        return [{ createdAt: direction }];
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  private normalizeSortOrder(sortOrder?: string): Prisma.SortOrder {
    return sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
  }

  private readonly userListSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    status: true,
    managerId: true,
    permissionVersion: true,
    lastLoginAt: true,
    createdAt: true,
    role: {
      select: {
        id: true,
        key: true,
        name: true,
      },
    },
    manager: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    },
  } satisfies Prisma.UserSelect;

  private readonly userDetailSelect = {
    ...this.userListSelect,
    mustChangePassword: true,
    suspendedAt: true,
    bannedAt: true,
    userSetting: {
      select: {
        timezone: true,
        locale: true,
        sidebarCollapsed: true,
      },
    },
    createdByUser: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    },
  } satisfies Prisma.UserSelect;
}
