import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { StudentsService } from './students.service';
import { Student } from '../entities/students.entity';
import { Group } from '../entities/group.entity';
import { StudentDiscount } from '../entities/studentDiscount';
import { FaceService } from '../common/faceId/faceId.service';
import { ContractsService } from '../contracts/contracts.service';
import { AuthenticatedUser } from '../common/interfaces/auth.interface';

describe('StudentsService - Uniqueness Constraints', () => {
  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    login: 'manager',
    role: 'manager' as any,
    branchId: 'branch-123',
  };

  const makeService = () => {
    const studentRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
    };
    const groupRepo = {
      findBy: jest.fn(),
    };
    const discountRepo = {
      save: jest.fn(),
    };

    const manager = {
      findBy: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((entity, payload) => payload),
      save: jest.fn((entity, payload) => Promise.resolve({ id: 'new-student-id', ...payload })),
    };

    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: manager,
    };

    const dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    };

    const faceService = {
      getDescriptorFromFile: jest.fn(),
    };

    const contractsService = {
      autoGenerateContract: jest.fn().mockResolvedValue(true),
    };

    const service = new StudentsService(
      studentRepo as unknown as Repository<Student>,
      groupRepo as unknown as Repository<Group>,
      discountRepo as unknown as Repository<StudentDiscount>,
      dataSource as unknown as DataSource,
      faceService as unknown as FaceService,
      contractsService as unknown as ContractsService,
    );

    // Mock findOne implementation to return formatted student
    jest.spyOn(service, 'findOne').mockImplementation((id: string) => {
      return Promise.resolve({
        id,
        fullName: 'Test Student',
        phone: '+998901112233',
        documentNumber: 'AB1234567',
        branch: { id: mockUser.branchId },
      } as any);
    });

    return {
      service,
      studentRepo,
      groupRepo,
      manager,
      queryRunner,
      dataSource,
    };
  };

  describe('create', () => {
    it('throws ConflictException if documentNumber is already used by an active student', async () => {
      const { service, manager } = makeService();

      manager.findBy.mockResolvedValue([{ id: 'group-123', price: 500000 }]);
      manager.findOne.mockResolvedValue({ id: 'existing-student-id', documentNumber: 'AB1234567' });

      await expect(
        service.create(
          {
            fullName: 'Javohir Karimov',
            phone: '+998901112233',
            documentNumber: 'AB1234567',
            groupIds: ['group-123'],
          },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);

      expect(manager.findOne).toHaveBeenCalledWith(Student, {
        where: { documentNumber: 'AB1234567' },
      });
    });

    it('allows creation if documentNumber is not provided', async () => {
      const { service, manager } = makeService();

      manager.findBy.mockResolvedValue([{ id: 'group-123', price: 500000 }]);
      manager.findOne.mockResolvedValue(null);

      const result = await service.create(
        {
          fullName: 'Javohir Karimov',
          phone: '+998901112233',
          groupIds: ['group-123'],
        },
        mockUser,
      );

      expect(result).toBeDefined();
      expect(manager.findOne).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws ConflictException if updating documentNumber to one that belongs to another student', async () => {
      const { service, manager } = makeService();

      const existingStudent = {
        id: 'student-789',
        fullName: 'Javohir Karimov',
        documentNumber: 'AA9999999',
        branch: { id: mockUser.branchId },
        enrolledGroups: [],
      };

      manager.findOne
        .mockResolvedValueOnce(existingStudent) // Find student to update
        .mockResolvedValueOnce({ id: 'other-student-456', documentNumber: 'AB1234567' }); // Find conflicting student

      await expect(
        service.update(
          'student-789',
          {
            documentNumber: 'AB1234567',
          },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('allows update if documentNumber belongs to the same student', async () => {
      const { service, manager } = makeService();

      const existingStudent = {
        id: 'student-789',
        fullName: 'Javohir Karimov',
        documentNumber: 'AB1234567',
        branch: { id: mockUser.branchId },
        enrolledGroups: [],
      };

      manager.findOne
        .mockResolvedValueOnce(existingStudent) // Find student to update
        .mockResolvedValueOnce(existingStudent); // Find conflicting student (same student)

      const result = await service.update(
        'student-789',
        {
          documentNumber: 'AB1234567',
        },
        mockUser,
      );

      expect(result).toBeDefined();
    });
  });

  describe('restore', () => {
    it('throws ConflictException on restore if documentNumber conflicts with an active student', async () => {
      const { service, studentRepo } = makeService();

      const studentToRestore = {
        id: 'student-789',
        documentNumber: 'AB1234567',
        branch: { id: mockUser.branchId },
      };

      studentRepo.findOne
        .mockResolvedValueOnce(studentToRestore) // Find in restore
        .mockResolvedValueOnce({ id: 'active-student-123', documentNumber: 'AB1234567' }); // Find conflicting active student

      await expect(service.restore('student-789', mockUser)).rejects.toThrow(ConflictException);
    });
  });
});
