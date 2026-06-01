import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';

import { ShellExecutorService } from './shell-executor.service';
import { CommandParser } from './command-parser.util';

@Module({
  providers: [ExecutionService, ShellExecutorService, CommandParser],
  exports: [ExecutionService, ShellExecutorService, CommandParser],
})
export class ExecutionModule {}
