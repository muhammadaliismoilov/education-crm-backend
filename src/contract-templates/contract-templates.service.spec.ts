import { Test, TestingModule } from '@nestjs/testing';
import { ContractTemplatesService } from './contract-templates.service';

describe('ContractTemplatesService', () => {
  let service: ContractTemplatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContractTemplatesService],
    }).compile();

    service = module.get<ContractTemplatesService>(ContractTemplatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
