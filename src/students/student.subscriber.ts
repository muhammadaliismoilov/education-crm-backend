import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { Student } from '../entities/students.entity';

@EventSubscriber()
export class StudentSubscriber implements EntitySubscriberInterface<Student> {
  /**
   * Ushbu subscriber Student entity'si uchun ishlaydi
   */
  listenTo() {
    return Student;
  }

  /**
   * Yangi talaba qo'shilishidan oldin ma'lumotlar yaxlitligini tekshirish
   */
  beforeInsert(event: InsertEvent<Student>) {
    this.syncFaceData(event.entity);
  }

  /**
   * Talaba ma'lumotlari yangilanishidan oldin ma'lumotlar yaxlitligini tekshirish
   */
  beforeUpdate(event: UpdateEvent<Student>) {
    // Agar rasm o'chirilgan bo'lsa (null bo'lsa), faceDescriptor ham majburiy null qilinadi
    if (event.entity) {
      this.syncFaceData(event.entity as Student);
    }
  }

  /**
   * Rasm va Face Descriptor o'rtasidagi mantiqiy bog'liqlikni ta'minlash.
   * Qoida: Rasm bo'lmasa, biometrik deskriptor ham bo'lishi mumkin emas.
   */
  private syncFaceData(student: Student) {
    if (!student.photoUrl || student.photoUrl.trim() === '') {
      student.faceDescriptor = null;
    }
  }
}
