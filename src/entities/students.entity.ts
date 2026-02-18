import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Group } from './group.entity';
import { Payment } from './payment.entity';
import { Attendance } from './attendance.entity';

export enum DocumentType {
  PASSPORT = 'passport',
  BIRTH_CERTIFICATE = 'birth_certificate',
}

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  parentName: string; // Ota-onasi ismi

  @Column({ nullable: true })
  parentPhone: string; // Ota-onasi nomeri

  @Column({ type: 'enum', enum: DocumentType, default:DocumentType.BIRTH_CERTIFICATE, nullable: true })
  documentType: DocumentType; // Masalan: 'PASSPORT' yoki 'BIRTH_CERTIFICATE'

  @Column({ unique: true, nullable: true })
  documentNumber: string; // Seriya va raqam birga: 'AB1234567'

  @Column({ unique: true, length: 14, nullable: true })
  pinfl: string; // 14 xonali JSHSHIR - bu eng aniq identifikator

  @Column({ type: 'date', nullable: true })
  birthDate: Date; // Talabaning tug'ilgan sanasi

  @Column({ nullable: true })
  direction: string; // Yo'nalish

  @Column({ nullable: true })
  photo: string; // Rasm 3x4

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: number;

  @ManyToMany(() => Group, (group) => group.students)
  enrolledGroups: Group[];

  @OneToMany(() => Payment, (payment) => payment.student)
  payments: Payment[];

  @OneToMany(() => Attendance, (attendance) => attendance.student)
  attendances: Attendance[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ select: false })
  deletedAt: Date;
}
