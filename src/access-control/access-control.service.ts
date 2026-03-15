import {
  PermissionEffect,
  PermissionType,
  UserStatus,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
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

@Injectable()
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
      permissionMap.set(rolePermission.permission.key, rolePermission.permission);
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
}
