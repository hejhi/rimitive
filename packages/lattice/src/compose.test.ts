import { describe, it, expect, vi } from 'vitest';
import { compose } from './compose';
import { defineModule } from './module';

describe('Module Composition System', () => {
  it('should create a context with modules', () => {
    let counterValue = 0;

    const Counter = defineModule({
      name: 'counter',
      create: () => () => ++counterValue,
    });

    const Logger = defineModule({
      name: 'log',
      create: () => vi.fn() as (message: string) => void,
    });

    const use = compose(Counter, Logger);
    const context = use();

    // Modules should be available
    expect('counter' in context).toBe(true);
    expect('log' in context).toBe(true);
    expect('dispose' in context).toBe(true);

    // Test counter
    expect(context.counter()).toBe(1);
    expect(context.counter()).toBe(2);

    context.dispose();
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
    const context = use();
    expect(init).toHaveBeenCalledOnce();
    expect(destroy).not.toHaveBeenCalled();

    context.dispose();
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

    // Pass all modules for proper typing (deps are still auto-resolved at runtime)
    const use = compose(Logger, Counter);
    const context = use();

    expect('counter' in context).toBe(true);
    expect('logger' in context).toBe(true);

    context.counter.increment();
    expect(context.logger.log).toHaveBeenCalledWith('Count: 1');

    context.dispose();
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
    const context = use();

    const r1 = context.createResource();
    const r2 = context.createResource();

    expect(r1.dispose).not.toHaveBeenCalled();
    expect(r2.dispose).not.toHaveBeenCalled();

    context.dispose();

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

    expect(() => compose(Ext1, Ext2)()).toThrow('Duplicate module name: test');
  });

  it('should support use() with callback pattern', () => {
    const Counter = defineModule({
      name: 'counter',
      create: () => () => 42,
    });

    const use = compose(Counter);

    // Test callback pattern
    const result = use(({ counter }) => counter());
    expect(result).toBe(42);

    // Test that callback receives the full context
    const contextKeys = use((ctx) => Object.keys(ctx));
    expect(contextKeys).toContain('counter');
    expect(contextKeys).toContain('dispose');
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

    // Pass all modules for proper typing (deps are still auto-resolved at runtime)
    const use = compose(A, B, C);
    const context = use();

    expect(context.a).toBe('A');
    expect(context.b).toBe('B(A)');
    expect(context.c).toBe('C(B(A))');

    context.dispose();
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

    // Pass all modules for proper typing
    const use = compose(A, B, C);
    const context = use();
    context.dispose();

    // Should be in reverse dependency order
    expect(order).toEqual(['C', 'B', 'A']);
  });
});
