import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Branch } from './branch.entity';

export enum SalaryPayoutStatus {
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

@Index(['teacher', 'branch', 'startDate', 'endDate'])
@Entity('salaryPayouts')
export class SalaryPayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column()
  forMonth: string;

  @Column({
    type: 'enum',
    enum: SalaryPayoutStatus,
    default: SalaryPayoutStatus.PAID,
  })
  status: SalaryPayoutStatus;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  calculationDetails: Record<string, any> | null;

  @ManyToOne(() => User, (user) => user.payouts)
  teacher: User;

  @ManyToOne(() => User, { nullable: true })
  paidBy: User;

  @CreateDateColumn()
  paidAt: Date;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @ManyToOne(() => Branch, { nullable: true })
  branch: Branch;

  @DeleteDateColumn({ name: 'deletedAt' })
  deletedAt: Date;
}
