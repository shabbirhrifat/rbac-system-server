import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentAuthUser } from '../auth/decorators/current-auth-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @RequirePermissions('tasks.read')
  listTasks(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.tasksService.listTasks(authUser.userId, query);
  }

  @Post()
  @RequirePermissions('tasks.create')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({ module: 'tasks', action: 'create', entityType: 'task' })
  createTask(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.createTask(authUser.userId, dto);
  }

  @Get(':id')
  @RequirePermissions('tasks.read')
  getTask(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.tasksService.getTask(authUser.userId, taskId);
  }

  @Patch(':id')
  @RequirePermissions('tasks.update')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({
    module: 'tasks',
    action: 'update',
    entityType: 'task',
    entityIdParam: 'id',
  })
  updateTask(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(authUser.userId, taskId, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('tasks.change_status')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({
    module: 'tasks',
    action: 'status.update',
    entityType: 'task',
    entityIdParam: 'id',
  })
  updateTaskStatus(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateTaskStatus(authUser.userId, taskId, dto);
  }

  @Patch(':id/assign')
  @RequirePermissions('tasks.assign')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({
    module: 'tasks',
    action: 'assign',
    entityType: 'task',
    entityIdParam: 'id',
  })
  assignTask(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
    @Body() dto: AssignTaskDto,
  ) {
    return this.tasksService.assignTask(authUser.userId, taskId, dto);
  }

  @Delete(':id')
  @RequirePermissions('tasks.delete')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction({
    module: 'tasks',
    action: 'delete',
    entityType: 'task',
    entityIdParam: 'id',
  })
  deleteTask(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.tasksService.deleteTask(authUser.userId, taskId);
  }
}
