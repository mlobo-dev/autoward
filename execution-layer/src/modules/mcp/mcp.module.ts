import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { ExecutionModule } from '../execution/execution.module';
import { AuditModule } from '../audit/audit.module';
import { McpController } from './mcp.controller';

@Module({
  imports: [ExecutionModule, AuditModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
