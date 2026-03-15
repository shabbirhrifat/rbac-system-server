import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { AuthenticatedRequest } from '../../auth/auth.types';
import { PrismaService } from '../../database/prisma.service';
import { AUDIT_ACTION_KEY } from '../common.constants';
import type { AuditActionMetadata, RequestContext } from '../common.types';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMetadata = this.reflector.getAllAndOverride<AuditActionMetadata>(
      AUDIT_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest & {
      requestContext?: RequestContext;
    }>();

    return next.handle().pipe(
      tap(async () => {
        if (!request.authUser) {
          return;
        }

        const requestContext = request.requestContext;
        const targetUserId = auditMetadata.targetUserParam
          ? this.getParamValue(request.params, auditMetadata.targetUserParam)
          : null;
        const entityId = auditMetadata.entityIdParam
          ? this.getParamValue(request.params, auditMetadata.entityIdParam)
          : null;

        await this.prisma.auditLog.create({
          data: {
            actorUserId: request.authUser.userId,
            targetUserId,
            module: auditMetadata.module,
            action: auditMetadata.action,
            entityType: auditMetadata.entityType,
            entityId,
            metadata: {
              method: request.method,
              path: request.originalUrl,
              requestId: requestContext?.requestId ?? null,
            },
            ipAddress: requestContext?.ipAddress ?? null,
            userAgent: requestContext?.userAgent ?? null,
          },
        });
      }),
    );
  }

  private getParamValue(
    params: Record<string, string | string[] | undefined>,
    paramName: string,
  ): string | null {
    const value = params[paramName];

    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value ?? null;
  }
}
