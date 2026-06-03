import { IpWhitelistGuard } from './ip-whitelist.guard';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * IP Whitelist Guard — Security Tests
 *
 * Asosiy tekshiruvlar:
 * - Production'da ALLOWED_IPS bo'sh bo'lsa BARCHA SO'ROVLAR BLOKLANADI (fail-closed)
 * - Development'da ALLOWED_IPS bo'sh bo'lsa ruxsat beriladi
 * - Ruxsat etilgan IP lar to'g'ri ishlanishi
 * - Bloklanishi kerak bo'lgan IP lar rad etilishi
 * - IPv6-mapped IPv4 normallashtirish
 */
describe('IpWhitelistGuard — Security', () => {
  let guard: IpWhitelistGuard;
  let configService: ConfigService;

  const createMockContext = (ip: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          ip,
          socket: { remoteAddress: ip },
        }),
      }),
    }) as any;

  // ──────────────────────────────────────────────────────────────
  // CRITICAL: Production'da bo'sh ALLOWED_IPS = BLOKLANADI
  // ──────────────────────────────────────────────────────────────
  describe('Empty ALLOWED_IPS in production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      configService = new ConfigService({ ALLOWED_IPS: '' });
      guard = new IpWhitelistGuard(configService);
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should BLOCK all requests when ALLOWED_IPS is empty in production', () => {
      const context = createMockContext('192.168.1.1');
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should BLOCK even localhost when ALLOWED_IPS is empty in production', () => {
      const context = createMockContext('127.0.0.1');
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Development'da bo'sh ALLOWED_IPS = ruxsat beriladi
  // ──────────────────────────────────────────────────────────────
  describe('Empty ALLOWED_IPS in development', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      configService = new ConfigService({ ALLOWED_IPS: '' });
      guard = new IpWhitelistGuard(configService);
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should ALLOW requests when ALLOWED_IPS is empty in development', () => {
      const context = createMockContext('192.168.1.1');
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // IP tekshiruvi (ALLOWED_IPS to'ldirilgan)
  // ──────────────────────────────────────────────────────────────
  describe('IP validation with configured whitelist', () => {
    beforeEach(() => {
      configService = new ConfigService({
        ALLOWED_IPS: '192.168.1.100,10.0.0.1,127.0.0.1',
      });
      guard = new IpWhitelistGuard(configService);
    });

    it('should ALLOW whitelisted IP', () => {
      const context = createMockContext('192.168.1.100');
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should ALLOW localhost when whitelisted', () => {
      const context = createMockContext('127.0.0.1');
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should BLOCK non-whitelisted IP', () => {
      const context = createMockContext('192.168.1.200');
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should BLOCK random attacker IP', () => {
      const context = createMockContext('45.33.32.156');
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // IPv6-mapped IPv4 normallashtirish
  // ──────────────────────────────────────────────────────────────
  describe('IPv6-mapped IPv4 normalization', () => {
    beforeEach(() => {
      configService = new ConfigService({
        ALLOWED_IPS: '127.0.0.1',
      });
      guard = new IpWhitelistGuard(configService);
    });

    it('should normalize ::ffff:127.0.0.1 to 127.0.0.1', () => {
      const context = createMockContext('::ffff:127.0.0.1');
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should block normalized IP that is not whitelisted', () => {
      const context = createMockContext('::ffff:192.168.1.200');
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
