import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Group } from './group.entity';
import { Payment } from './payment.entity';
import { Attendance } from './attendance.entity';
import { StudentDiscount } from './studentDiscount';
import { Invoice } from './invoice.entity';
import { Branch } from './branch.entity';

export enum DocumentType {
  PASSPORT = 'passport',
  BIRTH_CERTIFICATE = 'birth_certificate',
}

@Entity('students')
@Index('UQ_students_documentNumber_active', ['documentNumber'], {
  unique: true,
  where: '"deletedAt" IS NULL AND "documentNumber" IS NOT NULL',
})
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  fullName: string;

  @Index()
  @Column()
  phone: string;

  @Column({ nullable: true })
  parentName: string; // Ota-onasi ismi

  @Column({ nullable: true })
  parentPhone: string; // Ota-onasi nomeri

  @Column({
    type: 'enum',
    enum: DocumentType,
    default: DocumentType.BIRTH_CERTIFICATE,
    nullable: true,
  })
  documentType: DocumentType; // Masalan: 'PASSPORT' yoki 'BIRTH_CERTIFICATE'

  @Column({ nullable: true })
  documentNumber: string; // Seriya va raqam birga: 'AB1234567'

  @Column({ length: 14, nullable: true })
  pinfl: string; // 14 xonali JSHSHIR - ixtiyoriy

  @Column({ type: 'date', nullable: true })
  birthDate: Date; // Talabaning tug'ilgan sanasi

  @Column({ nullable: true })
  photoUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  faceDescriptor: number[];

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: number;

  @ManyToMany(() => Group, (group) => group.students)
  enrolledGroups: Group[];

  @OneToMany(() => StudentDiscount, (discount) => discount.student)
  discounts: StudentDiscount[];

  @OneToMany(() => Payment, (payment) => payment.student)
  payments: Payment[];

  @OneToMany(() => Invoice, (invoice) => invoice.student)
  invoices: Invoice[];

  @OneToMany(() => Attendance, (attendance) => attendance.student)
  attendances: Attendance[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @ManyToOne(() => Branch, { nullable: true })
  branch: Branch;
}
