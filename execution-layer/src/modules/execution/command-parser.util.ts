import { Injectable } from '@nestjs/common';

export interface CommandMetadata {
  binary: string;
  action: string;
  resource: string;
  args: string[];
  [key: string]: any; // Permite flags dinâmicas como namespace, replicas, etc.
}

@Injectable()
export class CommandParser {
  /**
   * Universal, agnostic shell command parser.
   * Breaks down any command into binary, action, resource, and arbitrary flags.
   */
  parse(command: string): CommandMetadata {
    const parts = command.trim().split(/\s+/);
    if (parts.length === 0) {
      throw new Error('Empty command');
    }

    const binary = parts[0];
    const positionalArgs: string[] = [];
    const flags: Record<string, string | number | boolean> = {};

    for (let i = 1; i < parts.length; i++) {
      const arg = parts[i];

      // Stop parsing flags if we hit shell chaining operators (we only audit the primary command intent)
      if (arg === '&&' || arg === '||' || arg === ';') break;

      if (arg.startsWith('--')) {
        if (arg.includes('=')) {
          const [key, value] = arg.slice(2).split('=');
          const numValue = Number(value);
          flags[key] = isNaN(numValue) ? value : numValue;
        } else {
          const nextArg = parts[i + 1];
          if (nextArg && !nextArg.startsWith('-')) {
            const numValue = Number(nextArg);
            flags[arg.slice(2)] = isNaN(numValue) ? nextArg : numValue;
            i++; // skip value
          } else {
            flags[arg.slice(2)] = true;
          }
        }
      } else if (arg.startsWith('-')) {
        const key = arg.slice(1);
        const nextArg = parts[i + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          flags[key] = nextArg;
          // Alias -n to namespace automatically for convenience without coupling to k8s
          if (key === 'n') flags['namespace'] = nextArg;
          i++; // skip value
        } else {
          flags[key] = true;
        }
      } else {
        positionalArgs.push(arg);
      }
    }

    let resource = positionalArgs[1] || '';
    if (resource.includes('/')) {
      resource = resource.split('/')[0];
    }

    return {
      raw_command: command,
      binary,
      action: positionalArgs[0] || '',
      resource,
      args: parts.slice(1),
      ...flags,
    };
  }
}
