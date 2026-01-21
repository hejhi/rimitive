import { describe, it, expect, vi } from 'vitest';
import { compose } from './compose';
import { defineModule, lazy } from './module';

describe('lazy()', () => {
  it('should return a Promise when lazy modules are present', async () => {
    const AsyncModule = lazy(
      defineModule({
        name: 'async',
        create: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { value: 42 };
        },
      })
    );

    const result = compose(AsyncModule);

    expect(result).toBeInstanceOf(Promise);

    const svc = await result;
    expect(svc.async.value).toBe(42);
  });

  it('should await lazy modules before dependents are created', async () => {
    const order: string[] = [];

    const AsyncDb = lazy(
      defineModule({
        name: 'db',
        create: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          order.push('db created');
          return { query: () => 'data' as const };
        },
      })
    );

    const UserService = defineModule({
      name: 'userService',
      dependencies: [AsyncDb],
      create: ({ db }) => {
        order.push('userService created');
        return { getUser: () => db.query() };
      },
    });

    const svc = await compose(AsyncDb, UserService);

    // db should be created before userService
    expect(order).toEqual(['db created', 'userService created']);
    expect(svc.userService.getUser()).toBe('data');
  });

  it('should throw runtime error for async create without lazy wrapper', () => {
    const AsyncModule = defineModule({
      name: 'async',
      create: async () => ({ value: 42 }),
    });

    // @ts-expect-error - testing that runtime throws for unwrapped async
    expect(() => compose(AsyncModule)).toThrow(
      'Async create() in module "async" requires lazy() wrapper'
    );
  });

  it('should work with mixed sync and lazy modules', async () => {
    const SyncModule = defineModule({
      name: 'sync',
      create: () => ({ value: 'sync' }),
    });

    const AsyncModule = lazy(
      defineModule({
        name: 'async',
        create: async () => ({ value: 'async' }),
      })
    );

    const svc = await compose(SyncModule, AsyncModule);

    expect(svc.sync.value).toBe('sync');
    expect(svc.async.value).toBe('async');
  });

  it('should call lifecycle hooks in correct order', async () => {
    const initOrder: string[] = [];
    const destroyOrder: string[] = [];

    const AsyncModule = lazy(
      defineModule({
        name: 'async',
        create: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return {};
        },
        init: () => initOrder.push('async'),
        destroy: () => destroyOrder.push('async'),
      })
    );

    const SyncModule = defineModule({
      name: 'sync',
      dependencies: [AsyncModule],
      create: () => ({}),
      init: () => initOrder.push('sync'),
      destroy: () => destroyOrder.push('sync'),
    });

    const svc = await compose(AsyncModule, SyncModule);

    expect(initOrder).toEqual(['async', 'sync']);

    svc.dispose();

    expect(destroyOrder).toEqual(['sync', 'async']);
  });

  it('should handle multiple lazy modules', async () => {
    const createOrder: string[] = [];

    const LazyA = lazy(
      defineModule({
        name: 'a',
        create: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          createOrder.push('a');
          return 'A';
        },
      })
    );

    const LazyB = lazy(
      defineModule({
        name: 'b',
        dependencies: [LazyA],
        create: async ({ a }) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          createOrder.push('b');
          return `B(${a})`;
        },
      })
    );

    const svc = await compose(LazyA, LazyB);

    expect(createOrder).toEqual(['a', 'b']);
    expect(svc.a).toBe('A');
    expect(svc.b).toBe('B(A)');
  });

  it('should unwrap Promise type in lazy module impl', async () => {
    // This test verifies that lazy() correctly transforms
    // Module<'db', Promise<DbPool>> to Module<'db', DbPool>

    interface DbPool {
      query: (sql: string) => string;
    }

    const DbModule = lazy(
      defineModule({
        name: 'db',
        create: async (): Promise<DbPool> => ({
          query: (sql: string) => `result: ${sql}`,
        }),
      })
    );

    const svc = await compose(DbModule);

    // svc.db should be DbPool, not Promise<DbPool>
    const result = svc.db.query('SELECT 1');
    expect(result).toBe('result: SELECT 1');
  });

  it('should have correct types for lazy module on context (type-level test)', async () => {
    // This test verifies ComposedContext correctly types lazy modules
    // The Promise type is correctly unwrapped - svc.db is DbPool, not Promise<DbPool>
    // The `const` generic constraint on defineModule preserves the literal name type

    interface DbPool {
      query: (sql: string) => string;
      close: () => void;
    }

    const DbModule = lazy(
      defineModule({
        name: 'db',
        create: async (): Promise<DbPool> => ({
          query: (sql: string) => `result: ${sql}`,
          close: () => {},
        }),
      })
    );

    const svc = await compose(DbModule);

    // svc.db is correctly typed as DbPool (not Promise<DbPool> or DbPool | undefined)
    const db = svc.db;

    // These work without ! because types are correctly inferred
    const queryResult: string = db.query('SELECT 1');
    db.close();

    expect(queryResult).toBe('result: SELECT 1');
  });

  it('should work with instrumentation', async () => {
    const instrumentCalls: string[] = [];

    const AsyncModule = lazy(
      defineModule({
        name: 'async',
        create: async () => ({ value: 42 }),
        instrument: (impl) => {
          instrumentCalls.push('async instrumented');
          return impl;
        },
      })
    );

    const instrumentation = {
      contextId: 'test',
      contextName: 'test',
      emit: vi.fn(),
      register: vi.fn((r) => ({ id: '1', resource: r })),
    };

    const svc = await compose(AsyncModule, { instrumentation });

    expect(instrumentCalls).toContain('async instrumented');
    expect(svc.async.value).toBe(42);
  });
});
