import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  OneToMany,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Attendance } from './attendance.entity';

@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('simple-array')
  days: string[];

  @Column()
  startTime: string;

  @Column({ type: 'decimal' })
  price: number;

  @ManyToOne(() => User, (user) => user.teachingGroups)
  teacher: User;

  @ManyToMany(() => User, (user) => user.enrolledGroups)
  @JoinTable()
  students: User[];

  @OneToMany(() => Attendance, (attendance) => attendance.group)
  attendances: Attendance[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
