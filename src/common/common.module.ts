import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { PermissionGuard } from './guards/permission.guard';
import { RequestContextMiddleware } from './middleware/request-context.middleware';
import { ActorContextService } from './services/actor-context.service';
import { ScopeGuard } from './guards/scope.guard';

@Global()
@Module({
  imports: [AccessControlModule],
  providers: [
    ActorContextService,
    PermissionGuard,
    ScopeGuard,
    AuditLogInterceptor,
  ],
  exports: [
    ActorContextService,
    PermissionGuard,
    ScopeGuard,
    AuditLogInterceptor,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
