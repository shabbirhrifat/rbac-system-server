import {
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class UserOverrideDto {
  @IsString()
  permissionKey!: string;

  @IsIn(['allow', 'deny'])
  effect!: 'allow' | 'deny';

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class ReplaceUserOverridesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserOverrideDto)
  overrides!: UserOverrideDto[];
}
