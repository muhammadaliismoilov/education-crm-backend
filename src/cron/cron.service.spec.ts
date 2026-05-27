import { DataSource, Repository } from 'typeorm';
import { CronService } from './cron.service';
import { Student } from '../entities/students.entity';

describe('CronService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-26T20:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const branchId = '11111111-1111-1111-1111-111111111111';
  const otherBranchId = '22222222-2222-2222-2222-222222222222';
  const studentId = '33333333-3333-3333-3333-333333333333';

  const makeQueryBuilder = (terminalMethod: string, result: unknown) => {
    const builder: Record<string, jest.Mock> = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
    };
    builder[terminalMethod] = jest.fn().mockResolvedValue(result);
    return builder;
  };

  const makeQueryRunner = (manager?: Record<string, unknown>) => ({
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue(undefined),
    manager,
  });

  const makeService = () => {
    const studentRepo = {
      find: jest.fn(),
    };
    const dataSource = {
      createQueryRunner: jest.fn(),
    };
    const service = new CronService(
      studentRepo as unknown as Repository<Student>,
      dataSource as unknown as DataSource,
    );
    jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

    return { service, studentRepo, dataSource };
  };

  it('skips monthly billing when another instance holds the DB lock', async () => {
    const { service, studentRepo, dataSource } = makeService();
    const lockRunner = makeQueryRunner();
    lockRunner.query.mockResolvedValueOnce([{ locked: false }]);
    dataSource.createQueryRunner.mockReturnValueOnce(lockRunner);

    await service.handleMonthlyBilling();

    expect(studentRepo.find).not.toHaveBeenCalled();
    expect(lockRunner.release).toHaveBeenCalledTimes(1);
  });

  it('creates only missing same-branch monthly invoices and recalculates touched student balances', async () => {
    const { service, studentRepo, dataSource } = makeService();
    const existingInvoiceBuilder = makeQueryBuilder('getRawMany', [
      { studentId, groupId: '44444444-4444-4444-4444-444444444444' },
    ]);
    const insertBuilder = makeQueryBuilder('execute', {});
    const manager = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(existingInvoiceBuilder)
        .mockReturnValueOnce(insertBuilder),
    };
    const lockRunner = makeQueryRunner();
    lockRunner.query
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([{ pg_advisory_unlock: true }]);
    const chunkRunner = makeQueryRunner(manager);

    dataSource.createQueryRunner
      .mockReturnValueOnce(lockRunner)
      .mockReturnValueOnce(chunkRunner);

    studentRepo.find
      .mockResolvedValueOnce([
        {
          id: studentId,
          branch: { id: branchId },
          enrolledGroups: [
            {
              id: '44444444-4444-4444-4444-444444444444',
              isActive: true,
              price: 100000,
              branch: { id: branchId },
            },
            {
              id: '55555555-5555-5555-5555-555555555555',
              isActive: true,
              price: 200000,
              branch: { id: branchId },
            },
            {
              id: '66666666-6666-6666-6666-666666666666',
              isActive: true,
              price: 300000,
              branch: { id: otherBranchId },
            },
          ],
          discounts: [
            {
              group: { id: '55555555-5555-5555-5555-555555555555' },
              customPrice: 150000,
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);

    await service.handleMonthlyBilling();

    expect(insertBuilder.values).toHaveBeenCalledWith([
      {
        amount: 150000,
        type: 'monthly_fee',
        billingMonth: '2026-05-01',
        student: { id: studentId },
        group: { id: '55555555-5555-5555-5555-555555555555' },
        branch: { id: branchId },
      },
    ]);
    expect(insertBuilder.orIgnore).toHaveBeenCalled();
    expect(chunkRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "students" s'),
      [[studentId]],
    );
    expect(chunkRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(chunkRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(lockRunner.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock($1)',
      [20260501],
    );
  });
});
