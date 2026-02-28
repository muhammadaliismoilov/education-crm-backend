// src/entities/student-discount.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Student } from './students.entity';
import { Group } from './group.entity';

@Entity('student_discounts')
export class StudentDiscount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, (student) => student.discounts, {
    onDelete: 'CASCADE',
  })
  student: Student;

  @ManyToOne(() => Group, (group) => group.discounts, {
    onDelete: 'CASCADE',
  })
  group: Group;

  // Imtiyozli narx
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  customPrice: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}