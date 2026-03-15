import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type ActorContext = {
  id: string;
  email: string;
  managerId: string | null;
  status: UserStatus;
  role: {
    id: string;
    key: string;
    name: string;
    level: number;
  };
};

@Injectable()
export class ActorContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getActorOrThrow(userId: string): Promise<ActorContext> {
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        managerId: true,
        status: true,
        role: {
          select: {
            id: true,
            key: true,
            name: true,
            level: true,
          },
        },
      },
    });

    if (!actor) {
      throw new NotFoundException('Actor not found');
    }

    return actor;
  }

  isAdmin(actor: ActorContext): boolean {
    return actor.role.key === 'admin';
  }

  isManager(actor: ActorContext): boolean {
    return actor.role.key === 'manager';
  }

  isAgent(actor: ActorContext): boolean {
    return actor.role.key === 'agent';
  }

  isCustomer(actor: ActorContext): boolean {
    return actor.role.key === 'customer';
  }

  getAllowedAssignableRoleKeys(actor: ActorContext): string[] {
    if (this.isAdmin(actor)) {
      return ['admin', 'manager', 'agent', 'customer'];
    }

    if (this.isManager(actor)) {
      return ['agent', 'customer'];
    }

    return [actor.role.key];
  }

  assertCanAssignRole(actor: ActorContext, roleKey: string): void {
    if (!this.getAllowedAssignableRoleKeys(actor).includes(roleKey)) {
      throw new ForbiddenException('Role assignment exceeds actor scope');
    }
  }

  assertCanAccessUser(
    actor: ActorContext,
    target: {
      id: string;
      managerId: string | null;
    },
  ): void {
    if (this.isAdmin(actor)) {
      return;
    }

    if (this.isManager(actor)) {
      if (target.id === actor.id || target.managerId === actor.id) {
        return;
      }

      throw new ForbiddenException('User outside manager scope');
    }

    if (target.id !== actor.id) {
      throw new ForbiddenException('User outside self scope');
    }
  }

  buildUserScopeWhere(actor: ActorContext): Prisma.UserWhereInput {
    if (this.isAdmin(actor)) {
      return {};
    }

    if (this.isManager(actor)) {
      return {
        OR: [{ id: actor.id }, { managerId: actor.id }],
      };
    }

    return { id: actor.id };
  }

  buildLeadScopeWhere(actor: ActorContext): Prisma.LeadWhereInput {
    if (this.isAdmin(actor)) {
      return { deletedAt: null };
    }

    if (this.isManager(actor)) {
      return {
        managerId: actor.id,
        deletedAt: null,
      };
    }

    if (this.isAgent(actor)) {
      return {
        OR: [{ assignedToUserId: actor.id }, { createdBy: actor.id }],
        deletedAt: null,
      };
    }

    return {
      customerId: actor.id,
      deletedAt: null,
    };
  }

  buildTaskScopeWhere(actor: ActorContext): Prisma.TaskWhereInput {
    if (this.isAdmin(actor)) {
      return { deletedAt: null };
    }

    if (this.isManager(actor)) {
      return {
        OR: [
          { createdBy: actor.id },
          { assignedToUser: { managerId: actor.id } },
          { lead: { managerId: actor.id } },
          { customer: { managerId: actor.id } },
        ],
        deletedAt: null,
      };
    }

    if (this.isAgent(actor)) {
      return {
        OR: [{ assignedToUserId: actor.id }, { createdBy: actor.id }],
        deletedAt: null,
      };
    }

    return {
      customerId: actor.id,
      deletedAt: null,
    };
  }

  getManagedManagerId(actor: ActorContext): string | null {
    if (this.isAdmin(actor)) {
      return null;
    }

    if (this.isManager(actor)) {
      return actor.id;
    }

    return actor.managerId;
  }
}
