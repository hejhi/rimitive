import { describe, it, expect, vi } from 'vitest';
import { compose, merge } from './compose';
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

    // Modules should be available as properties on use
    expect('counter' in use).toBe(true);
    expect('log' in use).toBe(true);
    expect('dispose' in use).toBe(true);

    // Test counter via property access
    expect(use.counter()).toBe(1);
    expect(use.counter()).toBe(2);

    use.dispose();
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

    // Pass all modules for proper typing (deps are still auto-resolved at runtime)
    const use = compose(Logger, Counter);

    expect('counter' in use).toBe(true);
    expect('logger' in use).toBe(true);

    use.counter.increment();
    expect(use.logger.log).toHaveBeenCalledWith('Count: 1');

    use.dispose();
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

    expect(use.a).toBe('A');
    expect(use.b).toBe('B(A)');
    expect(use.c).toBe('C(B(A))');

    use.dispose();
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
    use.dispose();

    // Should be in reverse dependency order
    expect(order).toEqual(['C', 'B', 'A']);
  });

  describe('merge', () => {
    it('should merge additional properties into a Use context', () => {
      const Counter = defineModule({
        name: 'counter',
        create: () => ({ count: 0 }),
      });

      const use = compose(Counter);
      const merged = merge(use, { theme: 'dark' });

      // Original properties preserved
      expect(merged.counter).toBe(use.counter);
      // New property added
      expect(merged.theme).toBe('dark');
    });

    it('should allow overriding existing properties', () => {
      const Counter = defineModule({
        name: 'counter',
        create: () => ({ count: 0 }),
      });

      const use = compose(Counter);
      const customCounter = { count: 100 };
      const merged = merge(use, { counter: customCounter });

      // Property is overridden
      expect(merged.counter).toBe(customCounter);
      expect(merged.counter.count).toBe(100);
    });

    it('should preserve base service instances (same reactive graph)', () => {
      const state = { value: 0 };
      const Signal = defineModule({
        name: 'signal',
        create: () => () => state,
      });

      const use = compose(Signal);
      const merged = merge(use, { extra: 'data' });

      // Same instance reference
      expect(merged.signal).toBe(use.signal);
      expect(merged.signal()).toBe(use.signal());
    });

    it('should be callable with portables', () => {
      const Counter = defineModule({
        name: 'counter',
        create: () => () => 42,
      });

      const use = compose(Counter);
      const merged = merge(use, { multiplier: 2 });

      // Can call merged with a function
      const result = merged((svc) => svc.counter() * svc.multiplier);
      expect(result).toBe(84);
    });

    it('should support chaining multiple merges', () => {
      const Base = defineModule({
        name: 'base',
        create: () => 'base',
      });

      const use = compose(Base);
      const withTheme = merge(use, { theme: 'dark' });
      const withRouter = merge(withTheme, { route: '/home' });

      expect(withRouter.base).toBe('base');
      expect(withRouter.theme).toBe('dark');
      expect(withRouter.route).toBe('/home');
    });
  });

  describe('use as callable + properties', () => {
    it('should allow direct property access', () => {
      const Counter = defineModule({
        name: 'counter',
        create: () => () => 42,
      });

      const use = compose(Counter);

      // Direct property access
      expect(use.counter()).toBe(42);
    });

    it('should allow destructuring', () => {
      const Counter = defineModule({
        name: 'counter',
        create: () => () => 42,
      });

      const Logger = defineModule({
        name: 'logger',
        create: () => ({ log: vi.fn() }),
      });

      const use = compose(Counter, Logger);

      // Destructuring works
      const { counter, logger } = use;
      expect(counter()).toBe(42);
      expect(typeof logger.log).toBe('function');
    });

    it('should support both calling and property access in same portable', () => {
      const Counter = defineModule({
        name: 'counter',
        create: () => () => 10,
      });

      const use = compose(Counter);

      // Simulate a portable pattern
      const result = use((svc) => {
        // Can access via callback arg
        const fromCallback = svc.counter();
        // Can also access via use directly (same instance)
        const fromUse = use.counter();
        return fromCallback + fromUse;
      });

      expect(result).toBe(20);
    });
  });
});
