import { describe, it, expect, vi } from 'vitest';
import { createLatticeContext } from '../context';
import { createOnCleanup } from './on-cleanup';
import { createTestScopes } from '../test-helpers';

describe('onCleanup', () => {
  it('should register cleanup in active scope', () => {
    const ctx = createLatticeContext();
    const { createScope, disposeScope } = createTestScopes(ctx);
    const onCleanup = createOnCleanup(ctx);

    const element = {};
    const scope = createScope(element);
    ctx.activeScope = scope;

    const cleanup = vi.fn();
    onCleanup(cleanup);

    // Should be tracked in scope
    expect(scope.firstDisposable).toBeDefined();
    expect(scope.firstDisposable?.dispose).toBe(cleanup);

    // Dispose scope
    disposeScope(scope);

    // Cleanup should have been called
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('should do nothing when called outside a scope', () => {
    const ctx = createLatticeContext();
    const onCleanup = createOnCleanup(ctx);

    ctx.activeScope = null;

    const cleanup = vi.fn();

    // Should not throw
    expect(() => onCleanup(cleanup)).not.toThrow();

    // Cleanup should not have been called
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('should track multiple cleanups in order', () => {
    const ctx = createLatticeContext();
    const { createScope, disposeScope } = createTestScopes(ctx);
    const onCleanup = createOnCleanup(ctx);

    const element = {};
    const scope = createScope(element);
    ctx.activeScope = scope;

    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();
    const cleanup3 = vi.fn();

    onCleanup(cleanup1);
    onCleanup(cleanup2);
    onCleanup(cleanup3);

    // Should be tracked in LIFO order (linked list prepend)
    expect(scope.firstDisposable?.dispose).toBe(cleanup3);
    expect(scope.firstDisposable?.next?.dispose).toBe(cleanup2);
    expect(scope.firstDisposable?.next?.next?.dispose).toBe(cleanup1);

    // Dispose scope
    disposeScope(scope);

    // All cleanups should have been called
    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
    expect(cleanup3).toHaveBeenCalledTimes(1);
  });

  it('should work with withScope pattern', () => {
    const ctx = createLatticeContext();
    const { createScope, disposeScope } = createTestScopes(ctx);
    const onCleanup = createOnCleanup(ctx);

    const element = {};
    const cleanup = vi.fn();

    // Simulate withScope pattern
    const scope = createScope(element);
    const prevScope = ctx.activeScope;
    ctx.activeScope = scope;
    try {
      onCleanup(cleanup);
    } finally {
      ctx.activeScope = prevScope;
    }

    // Should be tracked
    expect(scope.firstDisposable).toBeDefined();

    // Dispose
    disposeScope(scope);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('should integrate with element lifecycle', () => {
    const ctx = createLatticeContext();
    const { createScope, disposeScope } = createTestScopes(ctx);
    const onCleanup = createOnCleanup(ctx);

    const element = { __mock: true };
    const scope = createScope(element);
    ctx.elementScopes.set(element, scope);

    // Run in scope
    ctx.activeScope = scope;

    const intervalCleanup = vi.fn();
    const eventCleanup = vi.fn();

    onCleanup(intervalCleanup);
    onCleanup(eventCleanup);

    ctx.activeScope = null;

    // When element is removed from DOM, scope should be disposed
    disposeScope(scope);
    ctx.elementScopes.delete(element);

    // Both cleanups should run
    expect(intervalCleanup).toHaveBeenCalledTimes(1);
    expect(eventCleanup).toHaveBeenCalledTimes(1);
  });
});
