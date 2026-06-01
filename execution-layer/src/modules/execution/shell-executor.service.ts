import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

@Injectable()
export class ShellExecutorService {
  private readonly logger = new Logger(ShellExecutorService.name);

  async execute(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      this.logger.log(`Executing command: ${command}`);
      
      // Limit execution time to 30 seconds
      const { stdout, stderr } = await execPromise(command, { timeout: 30000 });
      
      if (stderr) {
        this.logger.warn(`Command stderr: ${stderr}`);
      }

      return { stdout, stderr };
    } catch (error) {
      this.logger.error(`Command failed: ${error.message}`);
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
      };
    }
  }
}
