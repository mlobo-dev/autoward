import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from './modules/audit/audit.module';
import { PolicyModule } from './modules/policy/policy.module';
import { ExecutionModule } from './modules/execution/execution.module';
import { McpModule } from './modules/mcp/mcp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@audit-db:5432/audit_db',
      autoLoadEntities: true,
      synchronize: true, // Only for dev
    }),
    AuditModule,
    PolicyModule,
    ExecutionModule,
    McpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
