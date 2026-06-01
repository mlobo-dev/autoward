import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      console.error('AuthGuard: No token found in header');
      throw new UnauthorizedException();
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error(`Token is not a JWT: ${token.substring(0, 10)}...`);
      }
      const base64Payload = parts[1];
      const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());

      // Check if the token comes from our realm (minimal validation for POC)
      if (payload.iss && !payload.iss.includes('/realms/secure-agents')) {
        throw new Error(`Invalid token issuer: ${payload.iss}`);
      }

      request['user'] = payload;
      return true;
    } catch (error) {
      console.error('AuthGuard Error:', error.message);
      throw new UnauthorizedException(`Invalid or expired token. Error: ${error.message}`);
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
