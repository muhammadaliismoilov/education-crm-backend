import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Student } from '../src/entities/students.entity';
import { Invoice } from '../src/entities/invoice.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  
  console.log('--- Historical Invoices Seed Boshlandi ---');
  
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  
  try {
    const students = await queryRunner.manager.find(Student, {
      relations: ['enrolledGroups', 'discounts', 'discounts.group'],
    });
    
    let totalInvoicesCreated = 0;
    
    await queryRunner.startTransaction();
    
    for (const student of students) {
      if (!student.enrolledGroups || student.enrolledGroups.length === 0) continue;
      
      const existingInvoices = await queryRunner.manager.count(Invoice, {
        where: { student: { id: student.id } }
      });
      
      if (existingInvoices > 0) continue; // Already seeded
      
      for (const group of student.enrolledGroups) {
        const discount = student.discounts?.find(d => d.group?.id === group.id);
        const effectivePrice = discount && Number(discount.customPrice) > 0 
          ? Number(discount.customPrice) 
          : Number(group.price || 0);
          
        if (effectivePrice > 0) {
          const invoice = queryRunner.manager.create(Invoice, {
            amount: effectivePrice,
            type: 'monthly_fee',
            student: { id: student.id },
            group: { id: group.id },
            createdAt: student.createdAt // Set historical date
          });
          await queryRunner.manager.save(invoice);
          totalInvoicesCreated++;
        }
      }
    }
    
    await queryRunner.commitTransaction();
    console.log(`\n✅ Muvaffaqiyatli yakunlandi! Jami ${totalInvoicesCreated} ta tarixiy invoice yaratildi.`);
    console.log(`Bu hozirgi talabalar balansini oldingi holatda saqlab qoladi.\n`);
    
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Xatolik yuz berdi:', error);
  } finally {
    await queryRunner.release();
    await app.close();
  }
}

bootstrap();
