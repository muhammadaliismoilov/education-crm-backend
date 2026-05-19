import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ContractsService } from './contracts.service';
import { Contract, ContractStatus } from '../entities/contract.entity';
import { ContractTemplate } from '../entities/contract-template.entity';
import { Student } from '../entities/students.entity';
import { UserRole } from '../entities/user.entity';

describe('ContractsService', () => {
  const branchId = '11111111-1111-1111-1111-111111111111';
  const userId = '22222222-2222-2222-2222-222222222222';
  const studentId = '33333333-3333-3333-3333-333333333333';

  const makeService = () => {
    const contractRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const studentRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const contractTemplateRepo = {
      findOne: jest.fn(),
    };
    const manager = {
      findOne: jest.fn(),
      query: jest.fn().mockResolvedValue([{ max: null }]),
      create: jest.fn(
        (_entity: unknown, payload: Record<string, unknown>) => payload,
      ),
      save: jest.fn((_entity: unknown, payload: Record<string, unknown>) =>
        Promise.resolve({
          id: '44444444-4444-4444-4444-444444444444',
          ...payload,
        }),
      ),
    };
    const dataSource = {
      transaction: jest.fn(
        (
          _isolation: string,
          callback: (manager: EntityManager) => Promise<unknown>,
        ) => callback(manager as unknown as EntityManager),
      ),
    };

    const service = new ContractsService(
      contractRepo as unknown as Repository<Contract>,
      studentRepo as unknown as Repository<Student>,
      contractTemplateRepo as unknown as Repository<ContractTemplate>,
      dataSource as unknown as DataSource,
    );

    return {
      service,
      contractRepo,
      studentRepo,
      contractTemplateRepo,
      dataSource,
      manager,
    };
  };

  it('skips automatic generation when the student already has an active contract', async () => {
    const {
      service,
      contractRepo,
      studentRepo,
      contractTemplateRepo,
      dataSource,
    } = makeService();
    const existingContract = {
      id: '55555555-5555-5555-5555-555555555555',
      status: ContractStatus.DRAFT,
      student: { id: studentId },
      branch: { id: branchId },
    };
    contractRepo.findOne.mockResolvedValue(existingContract);
    studentRepo.findOne.mockResolvedValue({
      id: studentId,
      fullName: 'Ali Valiyev',
      phone: '+998901112233',
      branch: { id: branchId },
    });
    contractTemplateRepo.findOne.mockResolvedValue({
      id: '66666666-6666-6666-6666-666666666666',
      content: {
        title: 'Shartnoma {{contractNumber}}',
        body: '{{studentName}}',
      },
      branch: { id: branchId, name: 'Asosiy filial' },
    });

    const result = await service.autoGenerateContract(
      studentId,
      branchId,
      userId,
    );

    expect(result).toBeNull();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects bulk generation when the user has no branch context', async () => {
    const { service } = makeService();

    await expect(
      service.generateMissingContracts({
        id: userId,
        login: 'superadmin',
        role: UserRole.SUPERADMIN,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects manual contract creation without template, content, or file', async () => {
    const { service, studentRepo } = makeService();
    studentRepo.findOne.mockResolvedValue({
      id: studentId,
      fullName: 'Ali Valiyev',
      branch: { id: branchId },
    });

    await expect(
      service.create(
        {
          title: 'Bo`sh shartnoma',
          studentId,
        },
        {
          id: userId,
          login: 'admin',
          role: UserRole.ADMIN,
          branchId,
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
