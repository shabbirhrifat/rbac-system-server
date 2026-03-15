import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { ActorContextService } from '../common/services/actor-context.service';
import { PrismaService } from '../database/prisma.service';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService,
  ) {}

  async listTasks(actorUserId: string, query: ListTasksQueryDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.TaskWhereInput = {
      AND: [
        this.actorContextService.buildTaskScopeWhere(actor),
        query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' } },
                {
                  description: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {},
        query.status ? { status: this.parseTaskStatus(query.status) } : {},
        query.priority
          ? { priority: this.parseTaskPriority(query.priority) }
          : {},
        query.assignedToUserId
          ? { assignedToUserId: query.assignedToUserId }
          : {},
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: this.taskSelect,
      }),
      this.prisma.task.count({ where }),
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

  async createTask(actorUserId: string, dto: CreateTaskDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    await this.assertTaskAssigneeInScope(actor, dto.assignedToUserId);
    await this.assertLeadInScope(actor, dto.leadId);
    await this.assertCustomerInScope(actor, dto.customerId);

    return this.prisma.task.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        priority: dto.priority
          ? this.parseTaskPriority(dto.priority)
          : TaskPriority.MEDIUM,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        assignedToUserId: dto.assignedToUserId ?? null,
        leadId: dto.leadId ?? null,
        customerId: dto.customerId ?? null,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      },
      select: this.taskSelect,
    });
  }

  async getTask(actorUserId: string, taskId: string) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        ...this.actorContextService.buildTaskScopeWhere(actor),
      },
      select: this.taskSelect,
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async updateTask(actorUserId: string, taskId: string, dto: UpdateTaskDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    await this.ensureTaskInScope(actor, taskId);
    await this.assertLeadInScope(actor, dto.leadId);
    await this.assertCustomerInScope(actor, dto.customerId);

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim() || undefined,
        priority: dto.priority
          ? this.parseTaskPriority(dto.priority)
          : undefined,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        leadId: dto.leadId ?? undefined,
        customerId: dto.customerId ?? undefined,
        updatedBy: actorUserId,
      },
      select: this.taskSelect,
    });
  }

  async updateTaskStatus(
    actorUserId: string,
    taskId: string,
    dto: UpdateTaskStatusDto,
  ) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    await this.ensureTaskInScope(actor, taskId);
    const status = this.parseTaskStatus(dto.status);

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        completedAt: status === TaskStatus.DONE ? new Date() : null,
        updatedBy: actorUserId,
      },
      select: this.taskSelect,
    });
  }

  async assignTask(actorUserId: string, taskId: string, dto: AssignTaskDto) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    await this.ensureTaskInScope(actor, taskId);
    await this.assertTaskAssigneeInScope(actor, dto.assignedToUserId);

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        assignedToUserId: dto.assignedToUserId ?? null,
        updatedBy: actorUserId,
      },
      select: this.taskSelect,
    });
  }

  async deleteTask(actorUserId: string, taskId: string) {
    const actor = await this.actorContextService.getActorOrThrow(actorUserId);
    await this.ensureTaskInScope(actor, taskId);

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        deletedAt: new Date(),
        updatedBy: actorUserId,
      },
      select: this.taskSelect,
    });
  }

  private async ensureTaskInScope(
    actor: Awaited<ReturnType<ActorContextService['getActorOrThrow']>>,
    taskId: string,
  ) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        ...this.actorContextService.buildTaskScopeWhere(actor),
      },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }
  }

  private async assertTaskAssigneeInScope(
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

  private async assertLeadInScope(
    actor: Awaited<ReturnType<ActorContextService['getActorOrThrow']>>,
    leadId?: string,
  ) {
    if (!leadId) {
      return;
    }

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

  private parseTaskStatus(status: string): TaskStatus {
    const normalized = status.trim().toLowerCase();

    switch (normalized) {
      case 'todo':
        return TaskStatus.TODO;
      case 'in_progress':
      case 'in-progress':
        return TaskStatus.IN_PROGRESS;
      case 'done':
        return TaskStatus.DONE;
      case 'cancelled':
        return TaskStatus.CANCELLED;
      default:
        throw new BadRequestException('Unsupported task status');
    }
  }

  private parseTaskPriority(priority: string): TaskPriority {
    const normalized = priority.trim().toLowerCase();

    switch (normalized) {
      case 'low':
        return TaskPriority.LOW;
      case 'medium':
        return TaskPriority.MEDIUM;
      case 'high':
        return TaskPriority.HIGH;
      default:
        throw new BadRequestException('Unsupported task priority');
    }
  }

  private readonly taskSelect = {
    id: true,
    title: true,
    description: true,
    status: true,
    priority: true,
    dueAt: true,
    completedAt: true,
    createdAt: true,
    updatedAt: true,
    assignedToUser: {
      select: { id: true, email: true, firstName: true, lastName: true },
    },
    lead: {
      select: { id: true, name: true, status: true },
    },
    customer: {
      select: { id: true, email: true, firstName: true, lastName: true },
    },
  } satisfies Prisma.TaskSelect;
}
