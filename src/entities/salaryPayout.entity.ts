import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { User } from "./user.entity";

@Entity('salary_payouts')
export class SalaryPayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number; // Berilgan oylik miqdori

  @Column()
  forMonth: string; // Masalan: "2026-01" (Yanvar oyi uchun)

  @ManyToOne(() => User, (user) => user.payouts)
  teacher: User;

  @CreateDateColumn()
  paidAt: Date; // Pul berilgan haqiqiy vaqt

   @CreateDateColumn({ name: 'createdAt' })
    createdAt: Date;
  
    @UpdateDateColumn({ name: 'updatedAt' })
    updatedAt: Date;
}