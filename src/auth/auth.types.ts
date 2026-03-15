import type { Request } from 'express';

export type AccessTokenPayload = {
  sub: string;
  sid: string;
  email: string;
  role: string;
  ver: number;
  type: 'access';
};

export type RefreshTokenPayload = {
  sub: string;
  sid: string;
  ver: number;
  type: 'refresh';
};

export type AuthenticatedRequestUser = {
  userId: string;
  sessionId: string;
  email: string;
  role: string;
  permissionVersion: number;
  tokenType: 'access';
};

export type AuthenticatedRequest = Request & {
  authUser?: AuthenticatedRequestUser;
};

export type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};
