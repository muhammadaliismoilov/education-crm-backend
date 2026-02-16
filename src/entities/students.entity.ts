import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Group } from './group.entity';
import { Payment } from './payment.entity';
import { Attendance } from './attendance.entity';

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

  @Column({ nullable: true })
  direction: string; // Yo'nalish

  //pasport  seria malumotlari yoki tugilganlik haqidagiguvohnoma  malumotlarni kiritsh karak 

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
