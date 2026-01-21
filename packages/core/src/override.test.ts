import { describe, it, expect } from 'vitest';
import { override } from './override';
import { compose } from './compose';
import { defineModule, transient, lazy } from './module';

describe('override()', () => {
  it('should replace a dependency with a different module', () => {
    const RealLogger = defineModule({
      name: 'logger',
      create: () => ({ log: (msg: string) => `real: ${msg}` }),
    });

    const MockLogger = defineModule({
      name: 'logger',
      create: () => ({ log: (msg: string) => `mock: ${msg}` }),
    });

    const Service = defineModule({
      name: 'service',
      dependencies: [RealLogger],
      create: ({ logger }: { logger: { log: (msg: string) => string } }) => ({
        run: () => logger.log('hello'),
      }),
    });

    // Without override - uses RealLogger
    const realUse = compose(Service);
    expect(realUse.service.run()).toBe('real: hello');

    // With override - uses MockLogger
    const mockUse = compose(override(Service, { logger: MockLogger }));
    expect(mockUse.service.run()).toBe('mock: hello');
  });

  it('should alias replacement if it has a different name', () => {
    const ConsoleLogger = defineModule({
      name: 'logger',
      create: () => ({ log: (msg: string) => `console: ${msg}` }),
    });

    const FileLogger = defineModule({
      name: 'fileLogger', // Different name!
      create: () => ({ log: (msg: string) => `file: ${msg}` }),
    });

    const Service = defineModule({
      name: 'service',
      dependencies: [ConsoleLogger],
      create: ({ logger }: { logger: { log: (msg: string) => string } }) => ({
        run: () => logger.log('hello'),
      }),
    });

    // FileLogger has name 'fileLogger', but override aliases it to 'logger'
    const use = compose(override(Service, { logger: FileLogger }));
    expect(use.service.run()).toBe('file: hello');
  });

  it('should leave unspecified dependencies unchanged', () => {
    const Logger = defineModule({
      name: 'logger',
      create: (): { log: () => string } => ({ log: () => 'real' }),
    });

    const Config = defineModule({
      name: 'config',
      create: (): { env: string } => ({ env: 'prod' }),
    });

    const Service = defineModule({
      name: 'service',
      dependencies: [Logger, Config],
      create: ({
        logger,
        config,
      }: {
        logger: { log: () => string };
        config: { env: string };
      }) => ({
        getEnv: () => config.env,
        log: logger.log,
      }),
    });

    const MockLogger = defineModule({
      name: 'logger',
      create: (): { log: () => string } => ({ log: () => 'mocked' }),
    });

    // Only override logger, config stays the same
    const use = compose(override(Service, { logger: MockLogger }));

    expect(use.service.getEnv()).toBe('prod'); // Config unchanged
    expect(use.service.log()).toBe('mocked'); // Logger replaced
  });

  it('should not mutate the original module', () => {
    const Logger = defineModule({
      name: 'logger',
      create: () => 'real',
    });

    const MockLogger = defineModule({
      name: 'logger',
      create: () => 'mock',
    });

    const Service = defineModule({
      name: 'service',
      dependencies: [Logger],
      create: ({ logger }: { logger: string }) => logger,
    });

    override(Service, { logger: MockLogger });

    // Original module still uses original dependency
    const use = compose(Service);
    expect(use.service).toBe('real');
  });

  it('should work with transitive dependencies', () => {
    const DB = defineModule({
      name: 'db',
      create: (): { query: () => string } => ({ query: () => 'real-data' }),
    });

    const MockDB = defineModule({
      name: 'db',
      create: (): { query: () => string } => ({ query: () => 'mock-data' }),
    });

    const Repo = defineModule({
      name: 'repo',
      dependencies: [DB],
      create: ({ db }: { db: { query: () => string } }) => ({
        fetch: () => db.query(),
      }),
    });

    const Service = defineModule({
      name: 'service',
      dependencies: [Repo],
      create: ({ repo }: { repo: { fetch: () => string } }) => ({
        getData: () => repo.fetch(),
      }),
    });

    // To override a transitive dependency, override the entire chain:
    // Service depends on Repo, Repo depends on DB
    // We need to: 1) override Repo to use MockDB, 2) override Service to use the new Repo
    const MockedRepo = override(Repo, { db: MockDB });
    const MockedService = override(Service, { repo: MockedRepo });

    const use = compose(MockedService);

    expect(use.service.getData()).toBe('mock-data');
  });

  describe('override() with transient modules', () => {
    it('should preserve transient scope when overriding with a transient module', () => {
      let realCount = 0;
      let mockCount = 0;

      const RealLogger = transient(
        defineModule({
          name: 'logger',
          create: (): { id: number; type: string } => {
            realCount++;
            return { id: realCount, type: 'real' };
          },
        })
      );

      const MockLogger = transient(
        defineModule({
          name: 'logger',
          create: (): { id: number; type: string } => {
            mockCount++;
            return { id: mockCount, type: 'mock' };
          },
        })
      );

      const ServiceA = defineModule({
        name: 'serviceA',
        dependencies: [RealLogger],
        create: ({ logger }: { logger: { id: number; type: string } }) => ({
          loggerId: logger.id,
          loggerType: logger.type,
        }),
      });

      const ServiceB = defineModule({
        name: 'serviceB',
        dependencies: [RealLogger],
        create: ({ logger }: { logger: { id: number; type: string } }) => ({
          loggerId: logger.id,
          loggerType: logger.type,
        }),
      });

      // Override with mock transient logger
      const OverriddenServiceA = override(ServiceA, { logger: MockLogger });
      const OverriddenServiceB = override(ServiceB, { logger: MockLogger });

      const use = compose(OverriddenServiceA, OverriddenServiceB);

      // Both services should use mock logger
      expect(use.serviceA.loggerType).toBe('mock');
      expect(use.serviceB.loggerType).toBe('mock');

      // Each service should have its own transient instance (transient scope preserved)
      expect(use.serviceA.loggerId).not.toBe(use.serviceB.loggerId);

      // No real loggers were created
      expect(realCount).toBe(0);
    });

    it('should allow overriding a singleton with a transient', () => {
      let singletonCount = 0;
      let transientCount = 0;

      const SingletonLogger = defineModule({
        name: 'logger',
        create: () => {
          singletonCount++;
          return { id: singletonCount };
        },
      });

      const TransientLogger = transient(
        defineModule({
          name: 'logger',
          create: () => {
            transientCount++;
            return { id: transientCount };
          },
        })
      );

      const ServiceA = defineModule({
        name: 'serviceA',
        dependencies: [SingletonLogger],
        create: ({ logger }: { logger: { id: number } }) => ({
          loggerId: logger.id,
        }),
      });

      const ServiceB = defineModule({
        name: 'serviceB',
        dependencies: [SingletonLogger],
        create: ({ logger }: { logger: { id: number } }) => ({
          loggerId: logger.id,
        }),
      });

      // Override singleton dependency with transient
      const OverriddenServiceA = override(ServiceA, { logger: TransientLogger });
      const OverriddenServiceB = override(ServiceB, { logger: TransientLogger });

      const use = compose(OverriddenServiceA, OverriddenServiceB);

      // Now each service should have its own instance
      expect(use.serviceA.loggerId).not.toBe(use.serviceB.loggerId);
      expect(singletonCount).toBe(0);
      expect(transientCount).toBeGreaterThan(1);
    });
  });

  describe('override() type safety', () => {
    it('should allow replacement with additional dependencies (they get resolved)', () => {
      // This test verifies that a replacement module with extra dependencies
      // works correctly - compose() will resolve the extra deps transitively

      const Config = defineModule({
        name: 'config',
        create: () => ({ level: 'debug' }),
      });

      const SimpleLogger = defineModule({
        name: 'logger',
        create: (): { log: (msg: string) => string } => ({
          log: (msg: string) => `simple: ${msg}`,
        }),
      });

      const ConfigurableLogger = defineModule({
        name: 'logger',
        dependencies: [Config], // Extra dependency not in original!
        create: ({ config }: { config: { level: string } }): { log: (msg: string) => string } => ({
          log: (msg: string) => `[${config.level}] ${msg}`,
        }),
      });

      const Service = defineModule({
        name: 'service',
        dependencies: [SimpleLogger],
        create: ({ logger }: { logger: { log: (msg: string) => string } }) => ({
          run: () => logger.log('hello'),
        }),
      });

      // Override with a logger that has extra dependencies
      const OverriddenService = override(Service, { logger: ConfigurableLogger });

      // compose() should resolve Config transitively through ConfigurableLogger
      const use = compose(OverriddenService);

      expect(use.service.run()).toBe('[debug] hello');
      expect(use.config.level).toBe('debug');
    });
  });

  describe('override() localization', () => {
    it('should only affect the overridden module, not other modules with same dependency', () => {
      const RealDB = defineModule({
        name: 'db',
        create: () => ({ type: 'real' }),
      });

      const MockDB = defineModule({
        name: 'db',
        create: () => ({ type: 'mock' }),
      });

      const UserService = defineModule({
        name: 'userService',
        dependencies: [RealDB],
        create: ({ db }: { db: { type: string } }) => ({ dbType: db.type }),
      });

      const AuditService = defineModule({
        name: 'auditService',
        dependencies: [RealDB],
        create: ({ db }: { db: { type: string } }) => ({ dbType: db.type }),
      });

      // Override db only for UserService
      const svc = compose(override(UserService, { db: MockDB }), AuditService);

      // UserService should get MockDB
      expect(svc.userService.dbType).toBe('mock');

      // AuditService should still get RealDB (not affected by override)
      expect(svc.auditService.dbType).toBe('real');
    });

    it('should allow different overrides for different modules', () => {
      const RealDB = defineModule({
        name: 'db',
        create: () => ({ type: 'real' }),
      });

      const MockDB = defineModule({
        name: 'db',
        create: () => ({ type: 'mock' }),
      });

      const TestDB = defineModule({
        name: 'db',
        create: () => ({ type: 'test' }),
      });

      const UserService = defineModule({
        name: 'userService',
        dependencies: [RealDB],
        create: ({ db }: { db: { type: string } }) => ({ dbType: db.type }),
      });

      const AuditService = defineModule({
        name: 'auditService',
        dependencies: [RealDB],
        create: ({ db }: { db: { type: string } }) => ({ dbType: db.type }),
      });

      // Different overrides for different services
      const svc = compose(
        override(UserService, { db: MockDB }),
        override(AuditService, { db: TestDB })
      );

      expect(svc.userService.dbType).toBe('mock');
      expect(svc.auditService.dbType).toBe('test');
    });

    it('should share instances when modules depend on the same module reference', () => {
      let dbCreateCount = 0;

      const SharedDB = defineModule({
        name: 'db',
        create: () => {
          dbCreateCount++;
          return { id: dbCreateCount };
        },
      });

      const UserService = defineModule({
        name: 'userService',
        dependencies: [SharedDB],
        create: ({ db }: { db: { id: number } }) => ({ dbId: db.id }),
      });

      const AuditService = defineModule({
        name: 'auditService',
        dependencies: [SharedDB],  // same reference as UserService
        create: ({ db }: { db: { id: number } }) => ({ dbId: db.id }),
      });

      const svc = compose(UserService, AuditService);

      // Both should share the same DB instance (same reference)
      expect(svc.userService.dbId).toBe(svc.auditService.dbId);
      expect(dbCreateCount).toBe(1);
    });
  });

  describe('override() aliased module caching', () => {
    it('should share aliased replacement instances across multiple overrides', () => {
      // BUG: When override() aliases a replacement (because it has a different name),
      // it creates a new object { ...replacement, name: dep.name }.
      // This breaks reference equality, causing duplicate instances.

      let fileLoggerCount = 0;

      const ConsoleLogger = defineModule({
        name: 'logger',
        create: () => ({ type: 'console' }),
      });

      const FileLogger = defineModule({
        name: 'fileLogger', // Different name - will be aliased to 'logger'
        create: () => {
          fileLoggerCount++;
          return { type: 'file', instanceId: fileLoggerCount };
        },
      });

      const ServiceA = defineModule({
        name: 'serviceA',
        dependencies: [ConsoleLogger],
        create: ({ logger }: { logger: { type: string; instanceId?: number } }) => ({
          loggerType: logger.type,
          loggerId: logger.instanceId,
        }),
      });

      const ServiceB = defineModule({
        name: 'serviceB',
        dependencies: [ConsoleLogger],
        create: ({ logger }: { logger: { type: string; instanceId?: number } }) => ({
          loggerType: logger.type,
          loggerId: logger.instanceId,
        }),
      });

      // Override both services with the same FileLogger
      const OverriddenA = override(ServiceA, { logger: FileLogger });
      const OverriddenB = override(ServiceB, { logger: FileLogger });

      const svc = compose(OverriddenA, OverriddenB);

      // Both services should use FileLogger
      expect(svc.serviceA.loggerType).toBe('file');
      expect(svc.serviceB.loggerType).toBe('file');

      // BUG: FileLogger is created twice because each override creates a
      // different aliased module object { ...FileLogger, name: 'logger' }
      // Expected: FileLogger should be created once and shared (singleton)
      expect(fileLoggerCount).toBe(1);
      expect(svc.serviceA.loggerId).toBe(svc.serviceB.loggerId);
    });
  });

  describe('override() with lazy modules', () => {
    it('should allow overriding a sync dependency with a lazy module', async () => {
      const SyncDb = defineModule({
        name: 'db',
        create: (): { query: () => string } => ({ query: () => 'sync' }),
      });

      const AsyncDb = lazy(
        defineModule({
          name: 'db',
          create: async (): Promise<{ query: () => string }> => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return { query: () => 'async' };
          },
        })
      );

      const Service = defineModule({
        name: 'service',
        dependencies: [SyncDb],
        create: ({ db }: { db: { query: () => string } }) => ({
          getData: () => db.query(),
        }),
      });

      // Override sync db with async db
      const OverriddenService = override(Service, { db: AsyncDb });

      const use = await compose(OverriddenService);

      expect(use.service.getData()).toBe('async');
    });

    it('should allow overriding a lazy dependency with a sync module', async () => {
      const AsyncDb = lazy(
        defineModule({
          name: 'db',
          create: async (): Promise<{ query: () => string }> => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return { query: () => 'async' };
          },
        })
      );

      const SyncDb = defineModule({
        name: 'db',
        create: (): { query: () => string } => ({ query: () => 'sync' }),
      });

      const Service = defineModule({
        name: 'service',
        dependencies: [AsyncDb],
        create: ({ db }: { db: { query: () => string } }) => ({
          getData: () => db.query(),
        }),
      });

      // Override async db with sync db
      const OverriddenService = override(Service, { db: SyncDb });

      // Since we removed the lazy module, compose should return synchronously
      const use = compose(OverriddenService);

      expect(use.service.getData()).toBe('sync');
    });

    it('should work with lazy mock for testing async code synchronously', () => {
      // Common testing pattern: override async dependencies with sync mocks
      const AsyncApi = lazy(
        defineModule({
          name: 'api',
          create: async (): Promise<{ fetch: () => string }> => {
            const response = await fetch('/data');
            return { fetch: () => response.toString() };
          },
        })
      );

      const MockApi = defineModule({
        name: 'api',
        create: (): { fetch: () => string } => ({
          fetch: () => 'mocked-data',
        }),
      });

      const Service = defineModule({
        name: 'service',
        dependencies: [AsyncApi],
        create: ({ api }: { api: { fetch: () => string } }) => ({
          load: () => api.fetch(),
        }),
      });

      // Test setup: use sync mock
      const TestService = override(Service, { api: MockApi });
      const use = compose(TestService);

      // Can test synchronously without await
      expect(use.service.load()).toBe('mocked-data');
    });
  });
});
