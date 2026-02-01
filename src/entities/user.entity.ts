import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  UpdateDateColumn,
  CreateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  DeleteDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Group } from './group.entity';
import { SalaryPayout } from './salaryPayout.entity';

// Faqat xodimlar rollari qoldi
export enum UserRole {
  ADMIN = 'admin',
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

  @Column({ type: 'int', nullable: true }) 
  salaryPercentage: number; // Faqat o'qituvchilar uchun foiz stavkasi


  // --- Bog'liqliklar ---

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

  @DeleteDateColumn({ select: false }) 
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