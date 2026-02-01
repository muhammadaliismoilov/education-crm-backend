import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Group } from './group.entity'; 
import { Student } from './students.entity';
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'date',nullable: true })
  paymentDate: string; 

  @ManyToOne(() => Student, (student) => student.payments, { onDelete: 'CASCADE' })
  student: Student;

  @ManyToOne(() => Group, (group) => group.payments, { onDelete: 'SET NULL' })
  group: Group; 

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}