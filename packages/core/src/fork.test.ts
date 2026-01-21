import { describe, it, expect, vi } from 'vitest';
import { fork } from './fork';
import { compose } from './compose';
import { defineModule, transient, lazy } from './module';
import type { Use } from './types';

describe('fork()', () => {
  it('should create fresh instances of specified modules', () => {
    let dbConnectionCount = 0;

    const Config = defineModule({
      name: 'config',
      create: () => ({ env: 'prod' }),
    });

    const DbConnection = defineModule({
      name: 'dbConnection',
      dependencies: [Config],
      create: ({ config }: { config: { env: string } }) => {
        dbConnectionCount++;
        return { id: dbConnectionCount, env: config.env };
      },
    });

    const root = compose(Config, DbConnection);

    expect(root.dbConnection.id).toBe(1);
    expect(dbConnectionCount).toBe(1);

    // Fork with fresh DbConnection
    const child = fork(root, [DbConnection]) as Use<typeof root>;

    // Child has fresh instance
    expect(child.dbConnection.id).toBe(2);
    expect(dbConnectionCount).toBe(2);

    // Root is unaffected
    expect(root.dbConnection.id).toBe(1);

    // Child inherited config from parent
    expect(child.config).toBe(root.config);
  });

  it('should share fresh instances within the fork', () => {
    let dbConnectionCount = 0;

    const DbConnection = defineModule({
      name: 'dbConnection',
      create: () => {
        dbConnectionCount++;
        return { id: dbConnectionCount };
      },
    });

    const UserService = defineModule({
      name: 'userService',
      dependencies: [DbConnection],
      create: ({ dbConnection }: { dbConnection: { id: number } }) => ({
        dbId: dbConnection.id,
      }),
    });

    const AuditService = defineModule({
      name: 'auditService',
      dependencies: [DbConnection],
      create: ({ dbConnection }: { dbConnection: { id: number } }) => ({
        dbId: dbConnection.id,
      }),
    });

    const root = compose(DbConnection, UserService, AuditService);

    // Root: all services share same DbConnection
    expect(root.userService.dbId).toBe(root.auditService.dbId);

    // Fork with fresh DbConnection, UserService, AuditService
    const child = fork(root, [DbConnection, UserService, AuditService]) as Use<
      typeof root
    >;

    // Child services share the SAME fresh DbConnection (singleton within fork)
    expect(child.userService.dbId).toBe(child.auditService.dbId);

    // But different from root's DbConnection
    expect(child.userService.dbId).not.toBe(root.userService.dbId);
  });

  it('should only dispose fresh instances on child.dispose()', () => {
    const rootDestroy = vi.fn();
    const childDestroy = vi.fn();

    const Config = defineModule({
      name: 'config',
      create: () => ({ env: 'test' }),
      destroy: rootDestroy,
    });

    const Connection = defineModule({
      name: 'connection',
      create: () => ({ connected: true }),
      destroy: childDestroy,
    });

    const root = compose(Config, Connection);
    const child = fork(root, [Connection]) as Use<typeof root>;

    // Dispose child
    child.dispose();

    // Only child's Connection destroy was called
    expect(childDestroy).toHaveBeenCalledOnce();
    expect(rootDestroy).not.toHaveBeenCalled();

    // Root is still functional
    expect(root.config.env).toBe('test');

    // Dispose root
    root.dispose();
    expect(rootDestroy).toHaveBeenCalledOnce();
  });

  it('should handle multiple forks independently', () => {
    let instanceCount = 0;

    const State = defineModule({
      name: 'state',
      create: () => {
        instanceCount++;
        return { id: instanceCount, value: 0 };
      },
    });

    const root = compose(State);
    expect(root.state.id).toBe(1);

    const fork1 = fork(root, [State]) as Use<typeof root>;
    expect(fork1.state.id).toBe(2);

    const fork2 = fork(root, [State]) as Use<typeof root>;
    expect(fork2.state.id).toBe(3);

    // All three are independent
    expect(root.state.id).toBe(1);
    expect(fork1.state.id).toBe(2);
    expect(fork2.state.id).toBe(3);

    // Disposing one doesn't affect others
    fork1.dispose();
    expect(root.state.id).toBe(1);
    expect(fork2.state.id).toBe(3);
  });

  it('should call init hooks for fresh modules', () => {
    const init = vi.fn();

    const Module = defineModule({
      name: 'mod',
      create: () => ({}),
      init,
    });

    const root = compose(Module);
    expect(init).toHaveBeenCalledTimes(1);

    fork(root, [Module]) as Use<typeof root>;
    expect(init).toHaveBeenCalledTimes(2);
  });

  it('should handle fresh modules that depend on other fresh modules', () => {
    let aCount = 0;
    let bCount = 0;

    const A = defineModule({
      name: 'a',
      create: () => {
        aCount++;
        return { id: aCount };
      },
    });

    const B = defineModule({
      name: 'b',
      dependencies: [A],
      create: ({ a }: { a: { id: number } }) => {
        bCount++;
        return { id: bCount, aId: a.id };
      },
    });

    const root = compose(A, B);
    expect(root.a.id).toBe(1);
    expect(root.b.aId).toBe(1);

    // Fork both A and B - B should get the fresh A
    const child = fork(root, [A, B]) as Use<typeof root>;
    expect(child.a.id).toBe(2);
    expect(child.b.aId).toBe(2); // B got the fresh A, not root's A
  });

  describe('fork() with transient modules', () => {
    it('should give fresh transient instances to each fresh module', () => {
      let loggerCount = 0;

      const Logger = transient(
        defineModule({
          name: 'logger',
          create: () => {
            loggerCount++;
            return { id: loggerCount };
          },
        })
      );

      const ServiceA = defineModule({
        name: 'serviceA',
        dependencies: [Logger],
        create: ({ logger }: { logger: { id: number } }) => ({
          loggerId: logger.id,
        }),
      });

      const ServiceB = defineModule({
        name: 'serviceB',
        dependencies: [Logger],
        create: ({ logger }: { logger: { id: number } }) => ({
          loggerId: logger.id,
        }),
      });

      const root = compose(ServiceA, ServiceB);
      const rootServiceALoggerId = root.serviceA.loggerId;
      const rootServiceBLoggerId = root.serviceB.loggerId;

      // Root: each service has its own transient logger
      expect(rootServiceALoggerId).not.toBe(rootServiceBLoggerId);

      // Fork with fresh ServiceA and ServiceB
      const child = fork(root, [ServiceA, ServiceB]) as Use<typeof root>;

      // Child services should get NEW transient logger instances
      expect(child.serviceA.loggerId).not.toBe(rootServiceALoggerId);
      expect(child.serviceB.loggerId).not.toBe(rootServiceBLoggerId);

      // Child services should each have their own transient instance
      expect(child.serviceA.loggerId).not.toBe(child.serviceB.loggerId);
    });

    it('should create fresh transient instances when forking a service that depends on transient', () => {
      let count = 0;

      const TransientModule = transient(
        defineModule({
          name: 'transientMod',
          create: () => {
            count++;
            return { id: count };
          },
        })
      );

      const Service = defineModule({
        name: 'service',
        dependencies: [TransientModule],
        create: ({ transientMod }: { transientMod: { id: number } }) => ({
          transientId: transientMod.id,
        }),
      });

      // Only pass Service to compose - transient is resolved as dependency
      const root = compose(Service);
      const rootTransientId = root.service.transientId;

      // Fork with fresh Service - should get fresh transient instance
      const child = fork(root, [Service]) as Use<typeof root>;

      // Child's service should have a different transient instance
      expect(child.service.transientId).not.toBe(rootTransientId);
    });

    it('should dispose transient instances with dispose method on fork disposal', () => {
      const cleanupCalls: number[] = [];
      let instanceCount = 0;

      const Logger = transient(
        defineModule({
          name: 'logger',
          create: (): { id: number; dispose: () => void } => {
            const id = ++instanceCount;
            return {
              id,
              dispose: () => {
                cleanupCalls.push(id);
              },
            };
          },
        })
      );

      const ServiceA = defineModule({
        name: 'serviceA',
        dependencies: [Logger],
        create: ({
          logger,
        }: {
          logger: { id: number; dispose: () => void };
        }) => ({
          loggerId: logger.id,
        }),
      });

      const ServiceB = defineModule({
        name: 'serviceB',
        dependencies: [Logger],
        create: ({
          logger,
        }: {
          logger: { id: number; dispose: () => void };
        }) => ({
          loggerId: logger.id,
        }),
      });

      const root = compose(ServiceA, ServiceB);
      // Root creates instances 1 (ServiceA), 2 (ServiceB)
      // (transients are not in context, only created for dependents)

      const child = fork(root, [ServiceA, ServiceB]) as Use<typeof root>;
      // Fork creates instances 3 (ServiceA), 4 (ServiceB)

      // Dispose only the fork
      child.dispose();

      // Only fork's transient instances should be disposed
      expect(cleanupCalls).toHaveLength(2);
      expect(cleanupCalls).toEqual([4, 3]); // Reverse order

      // Root is unaffected
      cleanupCalls.length = 0;
      root.dispose();
      expect(cleanupCalls).toHaveLength(2);
      expect(cleanupCalls).toEqual([2, 1]); // Root's transient instances
    });

    it('should not expose transient modules on the forked context', () => {
      let loggerCount = 0;

      const Logger = transient(
        defineModule({
          name: 'logger',
          create: () => {
            loggerCount++;
            return { id: loggerCount };
          },
        })
      );

      const Service = defineModule({
        name: 'service',
        dependencies: [Logger],
        create: ({ logger }: { logger: { id: number } }) => ({
          loggerId: logger.id,
        }),
      });

      const root = compose(Service);
      // Transient is NOT exposed on root context (correct behavior)
      expect('logger' in root).toBe(false);

      // Fork with both Service and Logger in freshModules
      // Transient should still NOT be exposed on child context
      const child = fork(root, [Logger, Service]) as Use<typeof root>;

      // BUG: Currently transient IS exposed on child context
      // Expected: transient should NOT be on context (same as compose)
      expect('logger' in child).toBe(false);
    });

    it('should call init() for nested transient dependencies not in freshModules', () => {
      // This tests that when a fresh transient depends on a transient NOT in freshModules,
      // the nested transient's init() is still called in the fork context
      const initCalls: string[] = [];

      // Inner transient - NOT passed to fork's freshModules
      const InnerTransient = transient(
        defineModule({
          name: 'inner',
          init: () => {
            initCalls.push('inner-init');
          },
          create: () => {
            return { value: 'inner' };
          },
        })
      );

      // Outer transient - depends on InnerTransient, WILL be in freshModules
      const OuterTransient = transient(
        defineModule({
          name: 'outer',
          dependencies: [InnerTransient],
          init: () => {
            initCalls.push('outer-init');
          },
          create: ({ inner }: { inner: { value: string } }) => {
            return { value: `outer(${inner.value})` };
          },
        })
      );

      // Service depends on OuterTransient
      const Service = defineModule({
        name: 'service',
        dependencies: [OuterTransient],
        create: ({ outer }: { outer: { value: string } }) => ({
          outerValue: outer.value,
        }),
      });

      const root = compose(Service);
      initCalls.length = 0; // Reset after root composition

      // Fork with ONLY OuterTransient (not InnerTransient) in freshModules
      // When OuterTransient is created, it needs InnerTransient
      // InnerTransient's init() should be called in the fork context
      const child = fork(root, [OuterTransient, Service]) as Use<typeof root>;

      // Both init() hooks should have been called
      expect(initCalls).toContain('outer-init');
      expect(initCalls).toContain('inner-init');

      // The service should work correctly
      expect(child.service.outerValue).toBe('outer(inner)');
    });
  });

  describe('fork() with lazy modules', () => {
    it('should return a Promise and create fresh instances for lazy modules', async () => {
      let dbCount = 0;

      const AsyncDb = lazy(
        defineModule({
          name: 'db',
          create: async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            dbCount++;
            return { id: dbCount };
          },
        })
      );

      const root = await compose(AsyncDb);
      expect(root.db!.id).toBe(1);

      const childPromise = fork(root, [AsyncDb]);
      expect(childPromise).toBeInstanceOf(Promise);

      const child = await childPromise;
      expect(child.db!.id).toBe(2);
    });
  });

  describe('nested forks', () => {
    it('should support forking a fork (fork of a fork)', () => {
      let instanceCount = 0;

      const State = defineModule({
        name: 'state',
        create: () => {
          instanceCount++;
          return { id: instanceCount };
        },
      });

      const root = compose(State);
      expect(root.state.id).toBe(1);

      // First level fork
      const level1 = fork(root, [State]) as Use<typeof root>;
      expect(level1.state.id).toBe(2);

      // Second level fork (fork of a fork)
      const level2 = fork(level1, [State]) as Use<typeof root>;
      expect(level2.state.id).toBe(3);

      // All three should be independent
      expect(root.state.id).toBe(1);
      expect(level1.state.id).toBe(2);
      expect(level2.state.id).toBe(3);
    });

    it('should inherit from the correct parent in nested forks', () => {
      const Config = defineModule({
        name: 'config',
        create: () => ({ value: 'root' }),
      });

      let stateCount = 0;
      const State = defineModule({
        name: 'state',
        dependencies: [Config],
        create: ({ config }: { config: { value: string } }) => {
          stateCount++;
          return { id: stateCount, configValue: config.value };
        },
      });

      const root = compose(Config, State);

      // Fork level 1 - gets root's Config
      const level1 = fork(root, [State]) as Use<typeof root>;
      expect(level1.config).toBe(root.config);
      expect(level1.state.configValue).toBe('root');

      // Fork level 2 from level 1 - should still inherit root's Config
      const level2 = fork(level1, [State]) as Use<typeof root>;
      expect(level2.config).toBe(root.config);
      expect(level2.state.configValue).toBe('root');
    });

    it('should dispose nested forks independently', () => {
      const destroyCalls: string[] = [];

      const State = defineModule({
        name: 'state',
        create: () => ({ value: 'state' }),
        destroy: () => destroyCalls.push('state'),
      });

      const root = compose(State);
      const level1 = fork(root, [State]) as Use<typeof root>;
      const level2 = fork(level1, [State]) as Use<typeof root>;

      // Dispose middle level
      level1.dispose();
      expect(destroyCalls).toEqual(['state']);

      // Root and level2 should still work
      expect(root.state.value).toBe('state');
      expect(level2.state.value).toBe('state');

      // Dispose level2
      level2.dispose();
      expect(destroyCalls).toEqual(['state', 'state']);

      // Root should still work
      expect(root.state.value).toBe('state');

      // Dispose root
      root.dispose();
      expect(destroyCalls).toEqual(['state', 'state', 'state']);
    });
  });

  describe('fork() with instrumentation', () => {
    it('should apply instrumentation to fresh modules', () => {
      const instrumentCalls: string[] = [];

      const State = defineModule({
        name: 'state',
        create: () => ({ value: 42 }),
        instrument: (impl) => {
          instrumentCalls.push('state instrumented');
          return impl;
        },
      });

      const instrumentation = {
        contextId: 'test',
        contextName: 'test',
        emit: vi.fn(),
        register: vi.fn((r) => ({ id: '1', resource: r })),
      };

      const root = compose(State);
      // Root without instrumentation - instrument not called
      expect(instrumentCalls).toEqual([]);

      // Fork with instrumentation - should instrument fresh modules
      const child = fork(root, [State], { instrumentation }) as Use<typeof root>;

      expect(instrumentCalls).toEqual(['state instrumented']);
      expect(child.state.value).toBe(42);
    });

    it('should apply instrumentation to transient modules in fork', () => {
      const instrumentCalls: string[] = [];

      const Logger = transient(
        defineModule({
          name: 'logger',
          create: () => ({ log: () => {} }),
          instrument: (impl) => {
            instrumentCalls.push('logger instrumented');
            return impl;
          },
        })
      );

      const Service = defineModule({
        name: 'service',
        dependencies: [Logger],
        create: ({ logger }) => ({ logger }),
        instrument: (impl) => {
          instrumentCalls.push('service instrumented');
          return impl;
        },
      });

      const instrumentation = {
        contextId: 'test',
        contextName: 'test',
        emit: vi.fn(),
        register: vi.fn((r) => ({ id: '1', resource: r })),
      };

      const root = compose(Service);

      // Fork with instrumentation
      fork(root, [Service], { instrumentation }) as Use<typeof root>;

      // Both service and its transient logger should be instrumented
      expect(instrumentCalls).toContain('service instrumented');
      expect(instrumentCalls).toContain('logger instrumented');
    });
  });

  describe('fork() for rebinding', () => {
    it('should use replacement module when fresh module has same name as dependency', () => {
      const RealDb = defineModule({
        name: 'db',
        create: () => ({ type: 'real' }),
      });

      const MockDb = defineModule({
        name: 'db',
        create: () => ({ type: 'mock' }),
      });

      const UserService = defineModule({
        name: 'userService',
        dependencies: [RealDb],
        create: ({ db }: { db: { type: string } }) => ({ dbType: db.type }),
      });

      const root = compose(RealDb, UserService);
      expect(root.userService.dbType).toBe('real');

      // Fork with MockDb (same name 'db') - acts like rebind
      const child = fork(root, [MockDb, UserService]) as Use<typeof root>;

      expect(child.userService.dbType).toBe('mock');
      // Root is unaffected
      expect(root.userService.dbType).toBe('real');
    });

    it('should allow different rebindings in different forks', () => {
      const RealDb = defineModule({
        name: 'db',
        create: () => ({ type: 'real' }),
      });

      const MockDb = defineModule({
        name: 'db',
        create: () => ({ type: 'mock' }),
      });

      const TestDb = defineModule({
        name: 'db',
        create: () => ({ type: 'test' }),
      });

      const Service = defineModule({
        name: 'service',
        dependencies: [RealDb],
        create: ({ db }: { db: { type: string } }) => ({ dbType: db.type }),
      });

      const root = compose(RealDb, Service);

      const mockFork = fork(root, [MockDb, Service]) as Use<typeof root>;
      const testFork = fork(root, [TestDb, Service]) as Use<typeof root>;

      expect(root.service.dbType).toBe('real');
      expect(mockFork.service.dbType).toBe('mock');
      expect(testFork.service.dbType).toBe('test');
    });
  });
});
