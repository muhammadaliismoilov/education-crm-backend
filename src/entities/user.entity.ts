import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  UpdateDateColumn,
  CreateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  DeleteDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Group } from './group.entity';
import { SalaryPayout } from './salaryPayout.entity';
import { Branch } from './branch.entity';
import { Expense } from './expense.entity';

// Xodimlar rollari
export enum UserRole {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  TEACHER = 'teacher',
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

  @Column({ type: 'enum', enum: UserRole, default: UserRole.TEACHER })
  role: UserRole;

  @OneToMany(() => Expense, (expense) => expense.createdBy)
  expenses: Expense[]; // Bu foydalanuvchi tomonidan yaratilgan xarajatlar

  @ManyToOne(() => Branch, (branch) => branch.users, { nullable: true })
  branch: Branch;

  @Column({ type: 'int', nullable: true })
  salaryPercentage: number; // Faqat o'qituvchilar uchun foiz stavkasi

  @OneToMany(() => Group, (group) => group.teacher)
  teachingGroups: Group[]; // O'qituvchining dars beradigan guruhlari

  @OneToMany(() => SalaryPayout, (payout) => payout.teacher)
  payouts: SalaryPayout[]; // O'qituvchiga qilingan oylik to'lovlar

  @Column({ type: 'text', nullable: true, select: false })
  refreshToken: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // --- Hooks ---

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 10); // Parolni xavfsiz saqlash
    }
  }
}
