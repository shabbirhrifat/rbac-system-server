import { SetMetadata } from '@nestjs/common';
import { AUDIT_ACTION_KEY } from '../common.constants';
import type { AuditActionMetadata } from '../common.types';

export const AuditAction = (metadata: AuditActionMetadata) =>
  SetMetadata(AUDIT_ACTION_KEY, metadata);
