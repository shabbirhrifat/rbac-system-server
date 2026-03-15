import { IsOptional, IsUUID } from 'class-validator';

export class AssignTaskDto {
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}
