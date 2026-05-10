import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  DeleteDateColumn,
} from 'typeorm';
import { Student } from './students.entity';
import { User } from './user.entity';
import { Branch } from './branch.entity';

export enum ContractStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  SIGNED = 'SIGNED',
}

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
