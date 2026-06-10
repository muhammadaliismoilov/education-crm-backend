import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Student } from './students.entity';
import { Group } from './group.entity';
import { Branch } from './branch.entity';

/**
 * Invoice holatlari:
 * - ACTIVE:    Haqiqiy qarz — balance hisobida ishtirok etadi
 * - CANCELLED: Bekor qilingan — balance hisobida QATNASHMAYDI, faqat tarix uchun
 */
export enum InvoiceStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

@Index(
  'IDX_invoices_monthly_student_group_month_unique',
  ['student', 'group', 'billingMonth'],
  {
    unique: true,
    where:
      `"type" = 'monthly_fee' AND "groupId" IS NOT NULL AND "billingMonth" IS NOT NULL AND "status" = 'ACTIVE'`,
  },
)
@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 50, default: 'monthly_fee' })
  type: string; // 'monthly_fee', 'joining_fee', 'penalty', etc.

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.ACTIVE,
  })
  status: InvoiceStatus;

  @Column({ type: 'date', nullable: true })
  billingMonth: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Student, (student) => student.invoices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'studentId' })
  student: Student;

  @ManyToOne(() => Group, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @ManyToOne(() => Branch, { nullable: true })
  branch: Branch;
}
