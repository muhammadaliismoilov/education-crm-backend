import { Test, TestingModule } from '@nestjs/testing';
import { ContractTemplatesController } from './contract-templates.controller';

describe('ContractTemplatesController', () => {
  let controller: ContractTemplatesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractTemplatesController],
    }).compile();

    controller = module.get<ContractTemplatesController>(
      ContractTemplatesController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
