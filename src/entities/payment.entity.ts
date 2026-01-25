import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Group } from './group.entity'; // Guruh bilan bog'lash uchun

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'date',nullable: true })
  paymentDate: string; // Dizayndagi "To'lov qilayotgan kun" (Inputdan keladi)

  @ManyToOne(() => User, (user) => user.payments, { onDelete: 'CASCADE' })
  student: User;

  @ManyToOne(() => Group, (group) => group.payments, { onDelete: 'SET NULL' })
  group: Group; // Dizayndagi "Yo'nalish" ustuni uchun

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}