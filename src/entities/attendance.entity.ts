import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Group } from './group.entity';
import { Student } from './students.entity';

@Entity('attendances')
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ default: false })
  isPresent: boolean;

  @ManyToOne(() => Group, (group) => group.attendances, { onDelete: 'CASCADE' })
  group: Group;

  @ManyToOne(() => Student, (student) => student.attendances, { onDelete: 'CASCADE' })
  student: Student;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
