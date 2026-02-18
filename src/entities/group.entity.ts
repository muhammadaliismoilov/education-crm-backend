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
  DeleteDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Attendance } from './attendance.entity';
import { Payment } from './payment.entity';
import { Student } from './students.entity';

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

  @Column()
  endTime: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    // transformer: {
    //   to: (value: number) => value,
    //   from: (value: string) => parseFloat(value), // Stringni numberga o'tkazadi
    // },
  })
  price: number;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, (user) => user.teachingGroups)
  teacher: User;

  @ManyToMany(() => Student, (student) => student.enrolledGroups)
  @JoinTable({ name: 'group_students' }) // Bog'lovchi jadval nomi aniq bo'lishi kerak
  students: Student[];

  @OneToMany(() => Payment, (payment) => payment.group)
  payments: Payment[];

  @OneToMany(() => Attendance, (attendance) => attendance.group)
  attendances: Attendance[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ select: false })
  deletedAt: Date;
}
