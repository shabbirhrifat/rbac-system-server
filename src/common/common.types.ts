export type RequestContext = {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
  startedAt: string;
};

export type RequestScope = 'self' | 'team' | 'team_or_self' | 'global';

export type AuditActionMetadata = {
  module: string;
  action: string;
  entityType: string;
  entityIdParam?: string;
  targetUserParam?: string;
};
