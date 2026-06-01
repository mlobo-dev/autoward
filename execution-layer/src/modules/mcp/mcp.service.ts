import { Injectable, Logger, OnModuleInit, ForbiddenException } from '@nestjs/common';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ShellExecutorService } from '../execution/shell-executor.service';
import { CommandParser } from '../execution/command-parser.util';
import { PolicyService } from '../policy/policy.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private shellExecutor: ShellExecutorService,
    private commandParser: CommandParser,
    private policyService: PolicyService,
    private auditService: AuditService,
  ) {}

  async onModuleInit() {}

  /**
   * Creates a new MCP Server instance pre-configured with Auto Ward tools.
   */
  public createServer(): Server {
    const server = new Server(
      {
        name: 'auto-ward-secure-proxy',
        version: '2.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupToolHandlers(server);
    return server;
  }

  private setupToolHandlers(server: Server) {
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'execute_shell_command',
          description: 'Executes a shell command (e.g., kubectl, terraform) with zero-trust validation',
          inputSchema: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'The full shell command to execute' },
              agent_token: { type: 'string', description: 'JWT Token from Keycloak' },
            },
            required: ['command', 'agent_token'],
          },
        },
      ],
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const defaultUser = { preferred_username: 'mcp-agent', roles: ['Developer'] }; 
      return this.handleToolCall(name, args as any, defaultUser);
    });
  }

  public async handleToolCall(name: string, args: any, user: any) {
    const token = args.agent_token;
    let command = args.command;

    if (!name) {
      name = 'execute_shell_command'; // Fallback for direct REST calls that might omit it
    }

    if (!command) {
      throw new ForbiddenException(`Missing command or unsupported tool: ${name}`);
    }

    // If a token is provided, decode it and use it as the user context
    let authenticatedUser = user;
    if (token) {
      try {
        const payloadBase64 = token.split('.')[1];
        authenticatedUser = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
        this.logger.debug(`Authenticated user from token: ${authenticatedUser.preferred_username}`);
      } catch (e) {
        this.logger.warn('Failed to decode agent_token, falling back to default user');
      }
    }



    // 1. Parse Command Metadata
    const metadata = this.commandParser.parse(command);

    // 2. Log Intent (Initial DENY)
    const auditLog = await this.auditService.logAction({
      agentId: authenticatedUser?.preferred_username || authenticatedUser?.sub || 'unknown',
      action: name,
      intent: { command, ...metadata },
      decision: 'DENY',
      context: { ...metadata },
    });

    // 3. Evaluate Policy with OPA
    const policyResult = await this.policyService.evaluate(name, authenticatedUser, {
      ...metadata,
      command,
      token,
    });

    auditLog.reason = policyResult.reason || 'Governance decision';
    auditLog.ruleId = policyResult.ruleId || 'default';

    if (!policyResult.allow) {
      await this.auditService.updateExecution(auditLog.id, 'BLOCKED', policyResult.reason || 'Denied by policy');
      throw new ForbiddenException(`Access Denied: ${policyResult.reason || 'Denied by policy'}`);
    }

    // 4. Execution Phase
    auditLog.decision = 'ALLOW';
    await this.auditService.updateLog(auditLog.id, { decision: 'ALLOW', reason: auditLog.reason });

    try {
      const result = await this.shellExecutor.execute(command);
      
      const status = result.stderr && !result.stdout ? 'FAILED' : 'SUCCESS';
      await this.auditService.updateExecution(auditLog.id, status, JSON.stringify(result));

      return {
        content: [
          { type: 'text', text: `Command output:\n${result.stdout}` },
          { type: 'text', text: `Command error (if any):\n${result.stderr}` },
        ],
      };
    } catch (error) {
      await this.auditService.updateExecution(auditLog.id, 'FAILED', error.message);
      return {
        content: [{ type: 'text', text: `Execution failed: ${error.message}` }],
        isError: true,
      };
    }
  }
}
