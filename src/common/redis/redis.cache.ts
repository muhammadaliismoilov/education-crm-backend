import { Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async invalidateByPatterns(patterns: string[]): Promise<void> {
    try {
      const store = (this.cacheManager as any).store;

      if (store?.keys) {
        for (const pattern of patterns) {
          const foundKeys: string[] = await store.keys(pattern);
          if (foundKeys.length > 0) {
            await Promise.all(
              foundKeys.map((k) => this.cacheManager.del(k)),
            );
            this.logger.log(
              `Cache invalidated [pattern: ${pattern}] [${foundKeys.length} ta key]`,
            );
          }
        }
      } else {
        await (this.cacheManager as any).reset?.();
        this.logger.warn('store.keys() ishlamadi — reset() ishlatildi');
      }
    } catch (e) {
      this.logger.warn(`Cache invalidation xatolik: ${e.message}`);
    }
  }

  async invalidateFinanceCache(): Promise<void> {
    await this.invalidateByPatterns([
      'finance_overview_*',
      'finance_yearly_*',
    ]);
  }
}