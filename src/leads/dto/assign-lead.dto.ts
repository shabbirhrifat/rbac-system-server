import { IsOptional, IsUUID } from 'class-validator';

export class AssignLeadDto {
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}
