import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { RequestContext } from '../common.types';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(
    request: Request & { requestContext?: RequestContext },
    _response: Response,
    next: NextFunction,
  ): void {
    request.requestContext = {
      requestId: randomUUID(),
      ipAddress: request.ip ?? null,
      userAgent: request.headers['user-agent'] ?? null,
      startedAt: new Date().toISOString(),
    };

    next();
  }
}
