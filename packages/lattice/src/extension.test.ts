import { describe, it, expect, vi } from 'vitest';
import { createContext } from './extension';
import type { LatticeExtension } from './extension';

describe('Extension System', () => {
  it('should create a context with custom extensions', () => {
    let counterValue = 0;

    const counterExtension: LatticeExtension<'counter', () => number> = {
      name: 'counter',
      method: () => ++counterValue,
    };

    const loggerExtension: LatticeExtension<'log', (message: string) => void> =
      {
        name: 'log',
        method: vi.fn(),
      };

    const context = createContext(counterExtension, loggerExtension);

    // Extensions should be available
    expect('counter' in context).toBe(true);
    expect('log' in context).toBe(true);
    expect('dispose' in context).toBe(true);

    // Test counter
    expect(context.counter()).toBe(1);
    expect(context.counter()).toBe(2);

    // Test logger
    context.log('test message');
    expect(loggerExtension.method).toHaveBeenCalledWith('test message');

    context.dispose();
  });

  it('should call lifecycle hooks', () => {
    const init = vi.fn();
    const destroy = vi.fn();

    const lifecycleExtension: LatticeExtension<'test', () => void> = {
      name: 'test',
      method: () => {},
      init,
      destroy,
    };

    const context = createContext(lifecycleExtension);
    expect(init).toHaveBeenCalledOnce();
    expect(destroy).not.toHaveBeenCalled();

    context.dispose();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('should wrap methods when wrapper is provided', () => {
    let disposed = false;

    const wrappedExtension: LatticeExtension<
      'wrapped',
      (value: string) => string
    > = {
      name: 'wrapped',
      method: (value: string) => value.toUpperCase(),
      adapt(method, ctx) {
        return (value: string) => {
          if (ctx.isDestroyed) {
            throw new Error('Context is disposed');
          }
          return method(value) + '!';
        };
      },
      destroy() {
        disposed = true;
      },
    };

    const context = createContext(wrappedExtension);

    // Test wrapped behavior
    expect(context.wrapped('hello')).toBe('HELLO!');

    context.dispose();
    expect(disposed).toBe(true);

    // Should throw after disposal
    expect(() => context.wrapped('test')).toThrow('Context is disposed');
  });

  it('should support custom resource tracking', () => {
    const disposables: Array<() => void> = [];

    const resourceExtension: LatticeExtension<
      'createResource',
      () => { dispose: () => void }
    > = {
      name: 'createResource',
      method: () => {
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

    const context = createContext(resourceExtension);

    const r1 = context.createResource();
    const r2 = context.createResource();

    expect(r1.dispose).not.toHaveBeenCalled();
    expect(r2.dispose).not.toHaveBeenCalled();

    context.dispose();

    expect(r1.dispose).toHaveBeenCalledOnce();
    expect(r2.dispose).toHaveBeenCalledOnce();
  });

  it('should prevent duplicate extension names', () => {
    const ext1: LatticeExtension<'test', () => void> = {
      name: 'test',
      method: () => {},
    };

    const ext2: LatticeExtension<'test', () => void> = {
      name: 'test',
      method: () => {},
    };

    expect(() => createContext(ext1, ext2)).toThrow(
      'Duplicate extension name: test'
    );
  });
});
