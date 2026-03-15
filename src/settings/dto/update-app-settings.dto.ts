import { IsObject } from 'class-validator';

export class UpdateAppSettingsDto {
  @IsObject()
  value!: Record<string, unknown>;
}
