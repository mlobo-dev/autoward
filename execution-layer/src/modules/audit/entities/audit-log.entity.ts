import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column()
  agentId: string;

  @Column()
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  intent: any;

  @Column()
  decision: 'ALLOW' | 'DENY';

  @Column({ nullable: true })
  reason: string;

  @Column({ nullable: true })
  ruleId: string;

  @Column({ type: 'jsonb', nullable: true })
  context: any;

  @Column({ nullable: true })
  executionStatus: string;

  @Column({ type: 'text', nullable: true })
  executionResult: string;
}
