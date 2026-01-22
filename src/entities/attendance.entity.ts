import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Group } from './groupe.entity';

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string; // Masalan: "2026-01-20"

  @Column({ default: false })
  isPresent: boolean;

  @ManyToOne(() => Group, (group) => group.attendances, { onDelete: 'CASCADE' })
  group: Group;

  @ManyToOne(() => User, (user) => user.attendances, { onDelete: 'CASCADE' })
  student: User;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
