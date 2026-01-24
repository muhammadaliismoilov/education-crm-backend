import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToMany,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { Group } from './groupe.entity';
import { Payment } from './payment.entity';
import { Attendance } from './attendance.entity';
import { SalaryPayout } from './salaryPayout.entity';

export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column({ unique: true })
  phone: string;

  @Column({ unique: true })
  login: string;

  @Column({ select: false })
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  @Column({ type: 'integer', default: null })
  salaryPercentage: number;

  @Column({ default: true })
  isActive: boolean; // O'quvchi markazdan ketgan bo'lsa, bu false bo'ladi

  @OneToMany(() => SalaryPayout, (payout) => payout.teacher)
  payouts: SalaryPayout[]; // O'qituvchining barcha oyliklar tari

  @OneToMany(() => Group, (group) => group.teacher)
  teachingGroups: Group[];

  @ManyToMany(() => Group, (group) => group.students)
  enrolledGroups: Group[];

  @OneToMany(() => Payment, (payment) => payment.student)
  payments: Payment[];

  @OneToMany(() => Attendance, (attendance) => attendance.student)
  attendances: Attendance[];

  @Column({ type: 'text', nullable: true, select: false })
  refreshToken: string | null; // Faqat string emas, string yoki null bo'lishi mumkin deb ko'rsatamiz

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
