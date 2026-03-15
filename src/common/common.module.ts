import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { PermissionGuard } from './guards/permission.guard';
import { RequestContextMiddleware } from './middleware/request-context.middleware';
import { ScopeGuard } from './guards/scope.guard';

@Module({
  imports: [AccessControlModule],
  providers: [PermissionGuard, ScopeGuard, AuditLogInterceptor],
  exports: [PermissionGuard, ScopeGuard, AuditLogInterceptor],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
