import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);
  private readonly opaUrl: string;

  constructor(private configService: ConfigService) {
    this.opaUrl = this.configService.get<string>('OPA_URL', 'http://opa:8181');
  }

  async evaluate(action: string, user: any, context: any): Promise<{ allow: boolean; reason?: string; ruleId?: string }> {
    try {
      const payload = {
        input: {
          action,
          user,
          context,
        },
      };

      this.logger.debug(`Evaluating policy for action: ${action}`);
      const response = await axios.post(`${this.opaUrl}/v1/data/governance/decision`, payload);
      const result = response.data?.result;
      this.logger.debug(`OPA Result: ${JSON.stringify(result)}`);
      return {
        allow: result?.decision?.allow ?? result?.allow ?? false,
        reason: (result?.decision?.reason ?? result?.reason) || 'OPA returned no result',
        ruleId: (result?.decision?.rule_id ?? result?.rule_id) || 'unknown-rule',
      };
    } catch (error) {
      this.logger.error(`Error evaluating policy: ${error.message}`);
      return { allow: false, reason: 'Policy Engine Error' };
    }
  }
}
