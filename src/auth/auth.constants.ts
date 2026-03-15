import type { CookieOptions } from 'express';

export const AUTH_ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL ?? '15m';
export const AUTH_REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TTL ?? '7d';
export const AUTH_LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
export const AUTH_LOGIN_LOCK_MS = 15 * 60 * 1000;
export const AUTH_MAX_FAILED_ATTEMPTS = 5;

export function getAccessTokenSecret(): string {
  return process.env.JWT_ACCESS_SECRET ?? 'change-this-access-secret';
}

export function getRefreshTokenSecret(): string {
  return process.env.JWT_REFRESH_SECRET ?? 'change-this-refresh-secret';
}

export function getRefreshCookieName(): string {
  return process.env.REFRESH_COOKIE_NAME ?? 'rbac_refresh_token';
}

export function durationToMilliseconds(duration: string): number {
  const normalized = duration.trim();
  const match = normalized.match(/^(\d+)(ms|s|m|h|d)?$/i);

  if (!match) {
    throw new Error(`Unsupported duration format: ${duration}`);
  }

  const value = Number(match[1]);
  const unit = (match[2] ?? 'ms').toLowerCase();

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

export function getAccessTokenExpiresInSeconds(): number {
  return Math.floor(durationToMilliseconds(AUTH_ACCESS_TOKEN_TTL) / 1000);
}

export function getRefreshTokenExpiresInMs(): number {
  return durationToMilliseconds(AUTH_REFRESH_TOKEN_TTL);
}

export function getRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: getRefreshTokenExpiresInMs(),
  };
}

export function getRefreshCookieClearOptions(): CookieOptions {
  const { maxAge, ...cookieOptions } = getRefreshCookieOptions();
  void maxAge;
  return cookieOptions;
}
