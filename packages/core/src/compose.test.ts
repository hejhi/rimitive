import { describe, it, expect, vi } from 'vitest';
import { compose } from './compose';
import { defineModule } from './module';

describe('compose()', () => {
  it('should compose modules into a usable context', () => {
    let counterValue = 0;

    const Counter = defineModule({
      name: 'counter',
      create: () => () => ++counterValue,
    });

    const use = compose(Counter);

    expect(use.counter()).toBe(1);
    expect(use.counter()).toBe(2);
  });

  it('should call lifecycle hooks', () => {
    const init = vi.fn();
    const destroy = vi.fn();

    const TestModule = defineModule({
      name: 'test',
      create: () => () => {},
      init,
      destroy,
    });

    const use = compose(TestModule);
    // init is called during compose
    expect(init).toHaveBeenCalledOnce();
    expect(destroy).not.toHaveBeenCalled();

    use.dispose();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('should resolve dependencies automatically', () => {
    const Logger = defineModule({
      name: 'logger',
      create: () => ({
        log: vi.fn() as (msg: string) => void,
      }),
    });

    const Counter = defineModule({
      name: 'counter',
      dependencies: [Logger],
      create: ({ logger }: { logger: { log: (msg: string) => void } }) => {
        let count = 0;
        return {
          increment: () => {
            count++;
            logger.log(`Count: ${count}`);
            return count;
          },
        };
      },
    });

    const use = compose(Logger, Counter);

    use.counter.increment();
    expect(use.logger.log).toHaveBeenCalledWith('Count: 1');
  });

  it('should support custom resource tracking via destroy', () => {
    const disposables: Array<() => void> = [];

    const ResourceFactory = defineModule({
      name: 'createResource',
      create: () => () => {
        const resource = {
          dispose: vi.fn(),
        };
        disposables.push(resource.dispose);
        return resource;
      },
      destroy() {
        // Dispose all resources when context is disposed
        disposables.forEach((dispose) => dispose());
      },
    });

    const use = compose(ResourceFactory);

    const r1 = use.createResource();
    const r2 = use.createResource();

    expect(r1.dispose).not.toHaveBeenCalled();
    expect(r2.dispose).not.toHaveBeenCalled();

    use.dispose();

    expect(r1.dispose).toHaveBeenCalledOnce();
    expect(r2.dispose).toHaveBeenCalledOnce();
  });

  it('should prevent duplicate module names', () => {
    const Ext1 = defineModule({
      name: 'test',
      create: () => () => {},
    });

    const Ext2 = defineModule({
      name: 'test',
      create: () => () => {},
    });

    expect(() => compose(Ext1, Ext2)).toThrow('Duplicate module name: test');
  });

  it('should support use() with callback pattern', () => {
    const Counter = defineModule({
      name: 'counter',
      create: () => () => 42,
    });

    const use = compose(Counter);

    const result = use(({ counter }) => counter());
    expect(result).toBe(42);
  });

  it('should handle transitive dependencies', () => {
    const A = defineModule({
      name: 'a',
      create: () => 'A',
    });

    const B = defineModule({
      name: 'b',
      dependencies: [A],
      create: ({ a }: { a: string }) => `B(${a})`,
    });

    const C = defineModule({
      name: 'c',
      dependencies: [B],
      create: ({ b }: { b: string }) => `C(${b})`,
    });

    const use = compose(A, B, C);

    expect(use.a).toBe('A');
    expect(use.b).toBe('B(A)');
    expect(use.c).toBe('C(B(A))');
  });

  it('should call destroy hooks in reverse order', () => {
    const order: string[] = [];

    const A = defineModule({
      name: 'a',
      create: () => 'A',
      destroy: () => order.push('A'),
    });

    const B = defineModule({
      name: 'b',
      dependencies: [A],
      create: () => 'B',
      destroy: () => order.push('B'),
    });

    const C = defineModule({
      name: 'c',
      dependencies: [B],
      create: () => 'C',
      destroy: () => order.push('C'),
    });

    const use = compose(A, B, C);
    use.dispose();

    expect(order).toEqual(['C', 'B', 'A']);
  });

  it('should support destructuring', () => {
    const Counter = defineModule({
      name: 'counter',
      create: () => () => 42,
    });

    const use = compose(Counter);
    const { counter } = use;

    expect(counter()).toBe(42);
  });

  it('should call dispose() on singleton implementations that have it', () => {
    const implDispose = vi.fn();

    const DbPool = defineModule({
      name: 'db',
      create: () => ({
        query: () => 'result',
        dispose: implDispose,
      }),
    });

    const use = compose(DbPool);

    // Use the module
    expect(use.db.query()).toBe('result');

    // Dispose should call the implementation's dispose()
    use.dispose();

    expect(implDispose).toHaveBeenCalledOnce();
  });
});
