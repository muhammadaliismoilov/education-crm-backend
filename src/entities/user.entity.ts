import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToMany,
  JoinTable, // Bog'liqlik jadvali uchun shart
  UpdateDateColumn,
  CreateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  DeleteDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Group } from './group.entity';
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

  @Column({ type: 'int', nullable: true }) 
  salaryPercentage: number;

  @Column({ default: true })
  isActive: boolean;
  
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  balance: number;

  // --- Bog'liqliklar ---

  @OneToMany(() => SalaryPayout, (payout) => payout.teacher)
  payouts: SalaryPayout[];

  @OneToMany(() => Group, (group) => group.teacher)
  teachingGroups: Group[];

  @ManyToMany(() => Group, (group) => group.students)
  enrolledGroups: Group[];

  @OneToMany(() => Payment, (payment) => payment.student)
  payments: Payment[];

  @OneToMany(() => Attendance, (attendance) => attendance.student)
  attendances: Attendance[];

  @Column({ type: 'text', nullable: true, select: false })
  refreshToken: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ select: false }) 
  deletedAt: Date; 
  // --- Avtomatlashtirish (Hooks) ---

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    // Agar parol yangilangan bo'lsa yoki yangi bo'lsa hash qiladi
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }
}
