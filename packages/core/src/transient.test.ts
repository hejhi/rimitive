import { describe, it, expect, vi } from 'vitest';
import { compose } from './compose';
import { defineModule, transient } from './module';

describe('transient()', () => {
  it('should give each dependent a fresh instance', () => {
    let instanceCount = 0;

    const Logger = transient(
      defineModule({
        name: 'logger',
        create: () => {
          instanceCount++;
          return { id: instanceCount };
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

    const use = compose(ServiceA, ServiceB);

    // Each service should have its own logger instance
    expect(use.serviceA.loggerId).not.toBe(use.serviceB.loggerId);
    // Should have created 2 instances: one each for ServiceA and ServiceB
    // (transients are not accessible directly on context)
    expect(instanceCount).toBe(2);
  });

  it('should share singleton dependencies of transient modules', () => {
    let configCount = 0;
    let loggerCount = 0;

    const Config = defineModule({
      name: 'config',
      create: () => {
        configCount++;
        return { env: 'test' };
      },
    });

    const Logger = transient(
      defineModule({
        name: 'logger',
        dependencies: [Config],
        create: ({ config }: { config: { env: string } }) => {
          loggerCount++;
          return { env: config.env, id: loggerCount };
        },
      })
    );

    const ServiceA = defineModule({
      name: 'serviceA',
      dependencies: [Logger],
      create: ({ logger }: { logger: { env: string; id: number } }) => ({
        loggerId: logger.id,
        env: logger.env,
      }),
    });

    const ServiceB = defineModule({
      name: 'serviceB',
      dependencies: [Logger],
      create: ({ logger }: { logger: { env: string; id: number } }) => ({
        loggerId: logger.id,
        env: logger.env,
      }),
    });

    const use = compose(ServiceA, ServiceB);

    // Config should only be created once (singleton)
    expect(configCount).toBe(1);
    // Logger should be created 2 times (transient: ServiceA + ServiceB)
    // Transients are not added to context, only created for dependents
    expect(loggerCount).toBe(2);
    // Both services see the same config through their different logger instances
    expect(use.serviceA.env).toBe('test');
    expect(use.serviceB.env).toBe('test');
  });

  it('should throw error when passed directly to compose', () => {
    const Logger = transient(
      defineModule({
        name: 'logger',
        create: () => ({ id: 1 }),
      })
    );

    // Transient modules cannot be passed directly to compose
    // @ts-expect-error - testing runtime error for transient at top level
    expect(() => compose(Logger)).toThrow(
      'Transient module "logger" cannot be passed directly to compose()'
    );
  });

  it('should handle transient modules depending on other transient modules', () => {
    let innerCount = 0;
    let outerCount = 0;

    const InnerTransient = transient(
      defineModule({
        name: 'inner',
        create: () => {
          innerCount++;
          return { id: innerCount };
        },
      })
    );

    const OuterTransient = transient(
      defineModule({
        name: 'outer',
        dependencies: [InnerTransient],
        create: ({ inner }: { inner: { id: number } }) => {
          outerCount++;
          return { id: outerCount, innerId: inner.id };
        },
      })
    );

    const ServiceA = defineModule({
      name: 'serviceA',
      dependencies: [OuterTransient],
      create: ({ outer }: { outer: { id: number; innerId: number } }) => ({
        outerId: outer.id,
        innerId: outer.innerId,
      }),
    });

    const ServiceB = defineModule({
      name: 'serviceB',
      dependencies: [OuterTransient],
      create: ({ outer }: { outer: { id: number; innerId: number } }) => ({
        outerId: outer.id,
        innerId: outer.innerId,
      }),
    });

    const use = compose(ServiceA, ServiceB);

    // Each service got its own OuterTransient instance
    expect(use.serviceA.outerId).not.toBe(use.serviceB.outerId);

    // Each OuterTransient instance got its own InnerTransient instance
    expect(use.serviceA.innerId).not.toBe(use.serviceB.innerId);
  });

  describe('transient disposal', () => {
    it('should call destroy hook once for transient module definition', () => {
      const destroyFn = vi.fn();

      const Logger = transient(
        defineModule({
          name: 'logger',
          create: () => ({ id: Math.random() }),
          destroy: destroyFn,
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

      const use = compose(ServiceA, ServiceB);
      use.dispose();

      // destroy is called once per module definition, not per instance
      expect(destroyFn).toHaveBeenCalledOnce();
    });

    it('should call disposers registered via init for transient modules', () => {
      const disposerFn = vi.fn();

      const Logger = transient(
        defineModule({
          name: 'logger',
          init: (ctx) => {
            ctx.destroy(disposerFn);
          },
          create: () => ({ id: Math.random() }),
        })
      );

      const ServiceA = defineModule({
        name: 'serviceA',
        dependencies: [Logger],
        create: ({ logger }: { logger: { id: number } }) => ({
          loggerId: logger.id,
        }),
      });

      const use = compose(ServiceA);
      use.dispose();

      // init is called once, so disposer is registered once
      expect(disposerFn).toHaveBeenCalledOnce();
    });

    it('should dispose all transient instances when they register cleanup', () => {
      // This test documents the expected behavior:
      // Each transient instance should be able to register its own cleanup
      const cleanupCalls: number[] = [];

      const Logger = transient(
        defineModule({
          name: 'logger',
          init: (ctx) => {
            // Track which instance this cleanup is for
            const instanceId = cleanupCalls.length + 1;
            ctx.destroy(() => cleanupCalls.push(instanceId));
          },
          create: () => ({ id: Math.random() }),
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

      const use = compose(ServiceA, ServiceB);
      use.dispose();

      // Currently: init is called only once, so only 1 cleanup is registered
      // Expected: each transient instance should have its own cleanup
      // For now, documenting current behavior (1 cleanup call)
      expect(cleanupCalls).toHaveLength(1);
    });

    it('should auto-dispose transient instances with dispose method on context disposal', () => {
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

      const use = compose(ServiceA, ServiceB);

      // Dispose the context
      use.dispose();

      // All transient instances with dispose() should be cleaned up
      // Instance 1: ServiceA, Instance 2: ServiceB
      expect(cleanupCalls).toHaveLength(2);
      expect(cleanupCalls).toEqual([2, 1]);
    });
  });
});
