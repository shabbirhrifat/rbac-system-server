import { Module } from '@nestjs/common';
import { AccessControlModule } from './access-control/access-control.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { LeadsModule } from './leads/leads.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    CommonModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    AccessControlModule,
    DashboardModule,
    LeadsModule,
    TasksModule,
    ReportsModule,
    AuditLogsModule,
    CustomerPortalModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
