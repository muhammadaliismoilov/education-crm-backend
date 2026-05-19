import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Student } from './students.entity';
import { User } from './user.entity';
import { Branch } from './branch.entity';

export enum ContractStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  SIGNED = 'SIGNED',
}

@Index('IDX_contracts_active_student', ['student'], {
  where: '"deletedAt" IS NULL',
})
@Index(
  'IDX_contracts_active_branch_number_unique',
  ['branch', 'contractNumber'],
  {
    unique: true,
    where: '"deletedAt" IS NULL',
  },
)
@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'int', default: 1 })
  contractNumber: number;

  @Column({ type: 'jsonb', nullable: true })
  content: Record<string, any>;

  @Column({ nullable: true })
  fileUrl: string;

  @Column({ default: 1 })
  version: number;

  @Column({ type: 'enum', enum: ContractStatus, default: ContractStatus.DRAFT })
  status: ContractStatus;

  @ManyToOne(() => Student)
  student: Student;

  @ManyToOne(() => User)
  createdBy: User;

  @ManyToOne(() => User, { nullable: true })
  approvedBy: User;

  @ManyToOne(() => Branch, { nullable: true })
  branch: Branch;

  @Column({ type: 'timestamp', nullable: true })
  signedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
