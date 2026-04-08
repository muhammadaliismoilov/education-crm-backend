import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../../entities/branch.entity';

@Injectable()
export class SubdomainMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SubdomainMiddleware.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
  ) {}

  async use(
    req: Request & { resolvedBranchId?: string },
    res: Response,
    next: NextFunction,
  ) {
    try {
      // 1. Header orqali (frontend X-Branch-Subdomain yuboradi)
      const headerSubdomain = req.headers['x-branch-subdomain'] as string;

      // 2. Hostname orqali (testpro.crm.uz → testpro)
      const hostname = req.hostname || '';
      const parts = hostname.split('.');
      // testpro.crm.uz → parts = ['testpro', 'crm', 'uz']
      // crm.uz yoki localhost → asosiy domen
      const hostnameSubdomain = parts.length >= 3 ? parts[0] : null;

      const subdomain = headerSubdomain || hostnameSubdomain;

      if (subdomain && subdomain !== 'www') {
        // Bazadan branchni topish
        const branch = await this.branchRepo.findOne({
          where: { subdomain, isActive: true },
          select: ['id', 'subdomain', 'name'],
        });

        if (branch) {
          req.resolvedBranchId = branch.id;
          this.logger.debug(
            `Subdomain aniqlandi [${subdomain}] → Branch [${branch.id}]`,
          );
        }
      }
    } catch (e) {
      // Middleware xatosi butun so'rovni to'xtatmasin
      this.logger.warn(`SubdomainMiddleware xatosi: ${e.message}`);
    }

    next();
  }
}
