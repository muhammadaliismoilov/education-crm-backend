import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User, UserRole } from '../entities/user.entity';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../common/interfaces/auth.interface';

/**
 * SECURITY-FOCUSED TESTS
 * Bu testlar xavfsizlik muammolarini aniqlash va oldini olish uchun.
 * Har bir test ma'lum bir zaiflikni tekshiradi.
 */
describe('UsersService — Security', () => {
  let service: UsersService;
  let mockRepo: any;

  const mockCreator: AuthenticatedUser = {
    id: 'creator-uuid',
    login: 'admin',
    role: UserRole.ADMIN,
    branchId: 'branch-uuid',
  };

  const mockSuperadmin: AuthenticatedUser = {
    id: 'superadmin-uuid',
    login: 'superadmin',
    role: UserRole.SUPERADMIN,
  };

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softRemove: jest.fn(),
      restore: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        where: jest.fn().mockReturnThis(),
        withDeleted: jest.fn().mockReturnThis(),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ──────────────────────────────────────────────────────────────
  // ISSUE #1: Password leak in response
  // ──────────────────────────────────────────────────────────────
  describe('create() — Password response leak prevention', () => {
    it('should NOT return password hash in the response', async () => {
      const savedUser = {
        id: 'new-uuid',
        fullName: 'Test User',
        phone: '+998901234567',
        login: 'testuser',
        password: '$2b$10$hashedPasswordValue',
        refreshToken: 'some-refresh-token',
        role: UserRole.TEACHER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepo.findOne.mockResolvedValue(null); // no duplicate
      mockRepo.create.mockReturnValue(savedUser);
      mockRepo.save.mockResolvedValue(savedUser);

      const result = await service.create(
        {
          fullName: 'Test User',
          phone: '+998901234567',
          login: 'testuser',
          password: 'password123',
          role: UserRole.TEACHER,
        },
        mockCreator,
      );

      // CRITICAL: response da password bo'lmasligi KERAK
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('refreshToken');
      expect((result as any).password).toBeUndefined();
      expect((result as any).refreshToken).toBeUndefined();

      // Ammo boshqa fieldlar mavjud bo'lishi kerak
      expect(result.id).toBe('new-uuid');
      expect(result.fullName).toBe('Test User');
      expect(result.login).toBe('testuser');
    });

    it('should still return all non-sensitive fields', async () => {
      const savedUser = {
        id: 'new-uuid',
        fullName: 'Ali Valiyev',
        phone: '+998901234567',
        login: 'ali',
        password: '$2b$10$hash',
        refreshToken: null,
        role: UserRole.TEACHER,
        salaryPercentage: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(savedUser);
      mockRepo.save.mockResolvedValue(savedUser);

      const result = await service.create(
        {
          fullName: 'Ali Valiyev',
          phone: '+998901234567',
          login: 'ali',
          password: 'secret123',
          role: UserRole.TEACHER,
          salaryPercentage: 30,
        },
        mockCreator,
      );

      expect(result.fullName).toBe('Ali Valiyev');
      expect(result.role).toBe(UserRole.TEACHER);
      expect(result.salaryPercentage).toBe(30);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Permission checks
  // ──────────────────────────────────────────────────────────────
  describe('create() — Role-based access control', () => {
    it('should NOT allow admin to create another admin', async () => {
      await expect(
        service.create(
          {
            fullName: 'Hacker',
            phone: '+998900000000',
            login: 'hacker',
            password: 'pass123',
            role: UserRole.ADMIN,
          },
          mockCreator,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should NOT allow admin to create superadmin', async () => {
      await expect(
        service.create(
          {
            fullName: 'Hacker',
            phone: '+998900000000',
            login: 'hacker',
            password: 'pass123',
            role: UserRole.SUPERADMIN,
          },
          mockCreator,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to create teacher', async () => {
      const savedUser = {
        id: 'new-uuid',
        fullName: 'Teacher',
        phone: '+998900000001',
        login: 'teacher1',
        password: '$2b$10$hash',
        role: UserRole.TEACHER,
      };
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(savedUser);
      mockRepo.save.mockResolvedValue(savedUser);

      const result = await service.create(
        {
          fullName: 'Teacher',
          phone: '+998900000001',
          login: 'teacher1',
          password: 'pass123',
          role: UserRole.TEACHER,
        },
        mockCreator,
      );

      expect(result.role).toBe(UserRole.TEACHER);
    });

    it('should enforce branch isolation for admin creator', async () => {
      const dto = {
        fullName: 'Teacher2',
        phone: '+998900000002',
        login: 'teacher2',
        password: 'pass123',
        role: UserRole.TEACHER,
        branchId: 'other-branch-uuid', // Admin boshqa branch ga qo'ymoqchi
      };

      const savedUser = {
        id: 'new-uuid',
        ...dto,
        password: '$2b$10$hash',
        branch: { id: mockCreator.branchId }, // Admin ning o'z branch'i qo'yilishi kerak
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(savedUser);
      mockRepo.save.mockResolvedValue(savedUser);

      await service.create(dto, mockCreator);

      // Admin creator bo'lsa, dto.branchId creator.branchId ga o'zgartirilishi kerak
      expect(dto.branchId).toBe(mockCreator.branchId);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Duplicate check
  // ──────────────────────────────────────────────────────────────
  describe('create() — Duplicate prevention', () => {
    it('should throw ConflictException for duplicate login', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'existing',
        login: 'testuser',
        phone: '+998909999999',
      });

      await expect(
        service.create(
          {
            fullName: 'Test',
            phone: '+998901234567',
            login: 'testuser',
            password: 'pass123',
            role: UserRole.TEACHER,
          },
          mockCreator,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for duplicate phone', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'existing',
        login: 'otherlogin',
        phone: '+998901234567',
      });

      await expect(
        service.create(
          {
            fullName: 'Test',
            phone: '+998901234567',
            login: 'newlogin',
            password: 'pass123',
            role: UserRole.TEACHER,
          },
          mockCreator,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
