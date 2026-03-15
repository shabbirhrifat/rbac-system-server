import { PermissionEffect, PermissionType, UserStatus } from '@prisma/client';
import {
  BadRequestException as NestBadRequestException,
  ForbiddenException as NestForbiddenException,
  Injectable as NestInjectable,
  NotFoundException as NestNotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SIDEBAR_ITEMS } from './access-control.constants';

type SidebarItem = {
  label: string;
  path: string;
  permission: string;
};

type PermissionRecord = {
  key: string;
  type: PermissionType;
  route: string | null;
};

export type ResolvedAccessProfile = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: UserStatus;
    managerId: string | null;
    mustChangePassword: boolean;
    permissionVersion: number;
    role: {
      id: string;
      key: string;
      name: string;
    };
    settings: {
      timezone: string | null;
      locale: string | null;
      sidebarCollapsed: boolean;
    };
  };
  permissions: {
    all: string[];
    pages: string[];
    actions: string[];
  };
  routes: string[];
  sidebarItems: SidebarItem[];
};

type UserOverrideInput = {
  permissionKey: string;
  effect: 'allow' | 'deny';
  expiresAt?: string | null;
};

@NestInjectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async getResolvedAccessProfile(
    userId: string,
  ): Promise<ResolvedAccessProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        managerId: true,
        mustChangePassword: true,
        permissionVersion: true,
        role: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
        userSetting: {
          select: {
            timezone: true,
            locale: true,
            sidebarCollapsed: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const now = new Date();
    const [rolePermissions, overrides] = await Promise.all([
      this.prisma.rolePermission.findMany({
        where: { roleId: user.role.id },
        select: {
          permission: {
            select: {
              key: true,
              type: true,
              route: true,
            },
          },
        },
      }),
      this.prisma.userPermission.findMany({
        where: {
          userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: {
          effect: true,
          permission: {
            select: {
              key: true,
              type: true,
              route: true,
            },
          },
        },
      }),
    ]);

    const permissionSet = new Set<string>();
    const permissionMap = new Map<string, PermissionRecord>();

    for (const rolePermission of rolePermissions) {
      permissionSet.add(rolePermission.permission.key);
      permissionMap.set(
        rolePermission.permission.key,
        rolePermission.permission,
      );
    }

    for (const override of overrides) {
      permissionMap.set(override.permission.key, override.permission);

      if (override.effect === PermissionEffect.ALLOW) {
        permissionSet.add(override.permission.key);
        continue;
      }

      permissionSet.delete(override.permission.key);
    }

    const allPermissions = Array.from(permissionSet).sort();
    const pagePermissions = allPermissions.filter(
      (key) => permissionMap.get(key)?.type === PermissionType.PAGE,
    );
    const actionPermissions = allPermissions.filter(
      (key) => permissionMap.get(key)?.type === PermissionType.ACTION,
    );
    const routes = Array.from(
      new Set(
        allPermissions
          .map((key) => permissionMap.get(key)?.route)
          .filter((route): route is string => Boolean(route)),
      ),
    ).sort();

    const sidebarItems: SidebarItem[] = SIDEBAR_ITEMS.filter((item) =>
      permissionSet.has(item.permission),
    ).map((item) => ({ ...item }));

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        managerId: user.managerId,
        mustChangePassword: user.mustChangePassword,
        permissionVersion: user.permissionVersion,
        role: user.role,
        settings: {
          timezone: user.userSetting?.timezone ?? null,
          locale: user.userSetting?.locale ?? null,
          sidebarCollapsed: user.userSetting?.sidebarCollapsed ?? false,
        },
      },
      permissions: {
        all: allPermissions,
        pages: pagePermissions,
        actions: actionPermissions,
      },
      routes,
      sidebarItems,
    };
  }

  async getPermissionCatalog() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { type: 'asc' }, { key: 'asc' }],
      select: {
        id: true,
        key: true,
        module: true,
        type: true,
        route: true,
        label: true,
        description: true,
      },
    });

    return {
      items: permissions,
      grouped: permissions.reduce<Record<string, typeof permissions>>(
        (accumulator, permission) => {
          const key = permission.module.toLowerCase();
          accumulator[key] ??= [];
          accumulator[key].push(permission);
          return accumulator;
        },
        {},
      ),
    };
  }

  async getGrantablePermissions(actorUserId: string) {
    const actorProfile = await this.getResolvedAccessProfile(actorUserId);

    if (!actorProfile) {
      return {
        items: [],
      };
    }

    const permissions = await this.prisma.permission.findMany({
      where: {
        key: {
          in: actorProfile.permissions.all,
        },
      },
      orderBy: [{ module: 'asc' }, { type: 'asc' }, { key: 'asc' }],
      select: {
        id: true,
        key: true,
        module: true,
        type: true,
        route: true,
        label: true,
        description: true,
      },
    });

    return {
      items: permissions,
    };
  }

  async getRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ level: 'desc' }],
      select: {
        id: true,
        key: true,
        name: true,
        level: true,
        isSystem: true,
        rolePermissions: {
          select: {
            permission: {
              select: {
                key: true,
                module: true,
                type: true,
                route: true,
                label: true,
              },
            },
          },
        },
      },
    });

    return {
      items: roles.map((role) => ({
        ...role,
        permissions: role.rolePermissions.map((item) => item.permission),
      })),
    };
  }

  async getUserAccess(actorUserId: string, targetUserId: string) {
    await this.assertUserInAccessScope(actorUserId, targetUserId);

    const [targetProfile, overrides] = await Promise.all([
      this.getResolvedAccessProfile(targetUserId),
      this.prisma.userPermission.findMany({
        where: { userId: targetUserId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          effect: true,
          expiresAt: true,
          createdAt: true,
          permission: {
            select: {
              id: true,
              key: true,
              module: true,
              type: true,
              route: true,
              label: true,
              description: true,
            },
          },
          grantedByUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    if (!targetProfile) {
      return null;
    }

    return {
      user: targetProfile.user,
      permissions: targetProfile.permissions,
      routes: targetProfile.routes,
      sidebarItems: targetProfile.sidebarItems,
      overrides,
    };
  }

  async replaceUserOverrides(
    actorUserId: string,
    targetUserId: string,
    overrides: UserOverrideInput[],
  ) {
    const actorProfile = await this.getResolvedAccessProfile(actorUserId);

    if (!actorProfile) {
      throw new NestNotFoundException('Actor access profile not found');
    }

    await this.assertUserInAccessScope(actorUserId, targetUserId);

    const grantablePermissions = new Set(actorProfile.permissions.all);
    const normalizedPermissions = Array.from(
      new Set(overrides.map((override) => override.permissionKey.trim())),
    );

    for (const permissionKey of normalizedPermissions) {
      if (!grantablePermissions.has(permissionKey)) {
        throw new NestForbiddenException(
          `Permission ${permissionKey} exceeds grant ceiling`,
        );
      }
    }

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: normalizedPermissions } },
      select: { id: true, key: true },
    });

    const permissionIdByKey = new Map(
      permissions.map((permission) => [permission.key, permission.id]),
    );

    if (permissionIdByKey.size !== normalizedPermissions.length) {
      throw new NestBadRequestException('One or more permissions do not exist');
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.userPermission.deleteMany({
        where: { userId: targetUserId },
      });

      if (overrides.length) {
        await transaction.userPermission.createMany({
          data: overrides.map((override) => ({
            userId: targetUserId,
            permissionId: permissionIdByKey.get(override.permissionKey.trim())!,
            effect:
              override.effect === 'allow'
                ? PermissionEffect.ALLOW
                : PermissionEffect.DENY,
            grantedBy: actorUserId,
            expiresAt: override.expiresAt ? new Date(override.expiresAt) : null,
          })),
        });
      }

      await transaction.user.update({
        where: { id: targetUserId },
        data: {
          permissionVersion: {
            increment: 1,
          },
        },
      });
    });

    return this.getUserAccess(actorUserId, targetUserId);
  }

  private async assertUserInAccessScope(
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    const [actor, target] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: actorUserId },
        select: {
          id: true,
          role: {
            select: {
              key: true,
            },
          },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          managerId: true,
        },
      }),
    ]);

    if (!actor) {
      throw new NestNotFoundException('Actor not found');
    }

    if (!target) {
      throw new NestNotFoundException('Target user not found');
    }

    if (actor.role.key === 'admin') {
      return;
    }

    if (actor.role.key === 'manager') {
      if (target.id === actor.id || target.managerId === actor.id) {
        return;
      }

      throw new NestForbiddenException('Target user outside manager scope');
    }

    if (target.id !== actor.id) {
      throw new NestForbiddenException('Target user outside self scope');
    }
  }
}
