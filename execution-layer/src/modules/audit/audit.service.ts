import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  async log(data: Partial<AuditLog>): Promise<AuditLog> {
    const log = this.auditRepository.create({
      ...data,
      timestamp: new Date(),
    });
    return this.auditRepository.save(log);
  }

  async updateStatus(id: string, decision: 'ALLOW' | 'DENY', executionStatus: string): Promise<void> {
    await this.auditRepository.update(id, { decision, executionStatus });
  }

  // Compatibilidade com código antigo enquanto migramos
  async logAction(data: Partial<AuditLog>): Promise<AuditLog> {
    return this.log(data);
  }

  async updateExecution(id: string | number, status: string, result: string): Promise<void> {
    // Mapeia status antigo para o novo formato se necessário
    const decision = status === 'DENY' || status === 'BLOCKED' ? 'DENY' : 'ALLOW';
    await this.auditRepository.update(id, { 
      decision, 
      executionStatus: status, 
      executionResult: result
    });
  }

  async updateLog(id: string | number, data: Partial<AuditLog>): Promise<void> {
    await this.auditRepository.update(id, data);
  }

  async findAll(): Promise<AuditLog[]> {
    return this.auditRepository.find({
      order: { timestamp: 'DESC' },
    });
  }
}
