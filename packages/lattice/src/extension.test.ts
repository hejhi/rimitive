import { describe, it, expect, vi } from 'vitest';
import { compose } from './extension';
import type { Service } from './extension';

describe('Extension System', () => {
  it('should create a context with custom extensions', () => {
    let counterValue = 0;

    const counterExtension: Service<'counter', () => number> = {
      name: 'counter',
      impl: () => ++counterValue,
    };

    const loggerExtension: Service<'log', (message: string) => void> = {
      name: 'log',
      impl: vi.fn(),
    };

    const context = compose(counterExtension, loggerExtension);

    // Extensions should be available
    expect('counter' in context).toBe(true);
    expect('log' in context).toBe(true);
    expect('dispose' in context).toBe(true);

    // Test counter
    expect(context.counter()).toBe(1);
    expect(context.counter()).toBe(2);

    // Test logger
    context.log('test message');
    expect(loggerExtension.impl).toHaveBeenCalledWith('test message');

    context.dispose();
  });

  it('should call lifecycle hooks', () => {
    const init = vi.fn();
    const destroy = vi.fn();

    const lifecycleExtension: Service<'test', () => void> = {
      name: 'test',
      impl: () => {},
      init,
      destroy,
    };

    const context = compose(lifecycleExtension);
    expect(init).toHaveBeenCalledOnce();
    expect(destroy).not.toHaveBeenCalled();

    context.dispose();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('should wrap impls when wrapper is provided', () => {
    let disposed = false;

    const wrappedExtension: Service<'wrapped', (value: string) => string> = {
      name: 'wrapped',
      impl: (value: string) => value.toUpperCase(),
      adapt(impl, ctx) {
        return (value: string) => {
          if (ctx.isDestroyed) {
            throw new Error('Context is disposed');
          }
          return impl(value) + '!';
        };
      },
      destroy() {
        disposed = true;
      },
    };

    const context = compose(wrappedExtension);

    // Test wrapped behavior
    expect(context.wrapped('hello')).toBe('HELLO!');

    context.dispose();
    expect(disposed).toBe(true);

    // Should throw after disposal
    expect(() => context.wrapped('test')).toThrow('Context is disposed');
  });

  it('should support custom resource tracking', () => {
    const disposables: Array<() => void> = [];

    const resourceExtension: Service<
      'createResource',
      () => { dispose: () => void }
    > = {
      name: 'createResource',
      impl: () => {
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
    };

    const context = compose(resourceExtension);

    const r1 = context.createResource();
    const r2 = context.createResource();

    expect(r1.dispose).not.toHaveBeenCalled();
    expect(r2.dispose).not.toHaveBeenCalled();

    context.dispose();

    expect(r1.dispose).toHaveBeenCalledOnce();
    expect(r2.dispose).toHaveBeenCalledOnce();
  });

  it('should prevent duplicate extension names', () => {
    const ext1: Service<'test', () => void> = {
      name: 'test',
      impl: () => {},
    };

    const ext2: Service<'test', () => void> = {
      name: 'test',
      impl: () => {},
    };

    expect(() => compose(ext1, ext2)).toThrow('Duplicate extension name: test');
  });
});
