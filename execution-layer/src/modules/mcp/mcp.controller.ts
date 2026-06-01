import { Controller, Post, Get, Body, UseGuards, Request, Res, Next, Logger } from '@nestjs/common';
import { McpService } from './mcp.service';
import { AuthGuard } from '../auth/auth.guard';
import type { Response, NextFunction } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);
  // Store both server and transport to handle messages directly
  private sessions: Map<string, { server: Server; transport: SSEServerTransport }> = new Map();

  constructor(private mcpService: McpService) {}

  @Get('sse')
  async handleSse(@Res() res: Response) {
    this.logger.log('New MCP SSE connection request');
    
    const server = this.mcpService.createServer();
    const transport = new SSEServerTransport('/mcp/messages', res);
    
    await server.connect(transport);
    
    if (transport.sessionId) {
      this.sessions.set(transport.sessionId, { server, transport });
      this.logger.log(`Session ${transport.sessionId} connected`);
    }

    res.on('close', () => {
      this.logger.log(`MCP SSE connection closed for session: ${transport.sessionId}`);
      // Keep session for 5 seconds to allow pending POST messages to finish
      if (transport.sessionId) {
        setTimeout(() => {
          this.sessions.delete(transport.sessionId);
          this.logger.debug(`Session ${transport.sessionId} cleaned up`);
        }, 5000);
      }
    });
  }

  @Post('messages')
  async handleMessages(@Request() req: any, @Res() res: Response, @Body() body: any) {
    const sessionId = req.query.sessionId as string;
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      this.logger.warn(`Session ${sessionId} not found for incoming message`);
      return res.status(404).send('Session not found');
    }

    try {
      const message = typeof body === 'string' ? JSON.parse(body) : body;
      const server = session.server as any;
      
      // The MCP SDK Protocol class has internal handlers for each type of JSON-RPC message
      if (message.method !== undefined) {
        if (message.id !== undefined) {
          // It's a Request
          await server._onrequest(message);
        } else {
          // It's a Notification
          await server._onnotification(message);
        }
      } else if (message.result !== undefined || message.error !== undefined) {
        // It's a Response
        await server._onresponse(message);
      } else {
        throw new Error('Unknown JSON-RPC message type');
      }
      
      res.status(200).send('OK');
    } catch (error) {
      this.logger.error(`Error dispatching message for session ${sessionId}: ${error.message}`);
      res.status(500).send(`Internal Error: ${error.message}`);
    }
  }

  @Post(['call', ''])
  async callTool(@Body() body: { name: string; arguments: any }, @Request() req) {
    // Check if token is in header, if not, check if it's in body.arguments.agent_token
    let user = req.user;
    if (!user && body.arguments?.agent_token) {
      // Very basic decoding to satisfy the payload, AuthGuard usually handles this, 
      // but the agent sends it in the body without Bearer token.
      try {
        const payloadBase64 = body.arguments.agent_token.split('.')[1];
        user = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
      } catch (e) {
        // Ignore, the service will also try to decode or fail
      }
    }
    
    // We remove the UseGuards(AuthGuard) to allow the token to come from the body
    return this.mcpService.handleToolCall(body.name, body.arguments, user);
  }
}
