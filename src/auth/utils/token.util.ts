import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { getRefreshCookieName } from '../auth.constants';

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function extractBearerToken(
  authorizationHeader?: string,
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

export function extractCookieValue(
  cookieHeader: string | undefined,
  cookieName: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');

    if (name === cookieName) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}

export function getRefreshTokenFromRequest(request: Request): string | null {
  const cookieName = getRefreshCookieName();
  const requestWithCookies = request as Request & {
    cookies?: Record<string, string>;
  };

  return (
    requestWithCookies.cookies?.[cookieName] ??
    extractCookieValue(request.headers.cookie, cookieName)
  );
}
