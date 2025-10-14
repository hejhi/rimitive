import { describe, it, expect, vi } from 'vitest';
import { createScope, runInScope, trackInScope, trackInSpecificScope, disposeScope } from './scope';
import { createViewContext } from '../context';
import type { Disposable } from '../types';

// Test utilities
function createMockDisposable(): Disposable & { disposed: boolean } {
  const mock = {
    disposed: false,
    dispose: vi.fn(() => {
      mock.disposed = true;
    }),
  };
  return mock;
}

describe('Scope Tree', () => {
  describe('createScope', () => {
    it('allows tracking and disposing disposables', () => {
      const scope = createScope();
      const disposable = createMockDisposable();

      trackInSpecificScope(scope, disposable);
      disposeScope(scope);

      // User cares: disposable was called
      expect(disposable.disposed).toBe(true);
    });

    it('disposes child scopes when parent is disposed', () => {
      const parent = createScope();
      const child = createScope(parent);

      const parentDisposable = createMockDisposable();
      const childDisposable = createMockDisposable();

      trackInSpecificScope(parent, parentDisposable);
      trackInSpecificScope(child, childDisposable);

      // Dispose parent
      disposeScope(parent);

      // User cares: both parent and child disposables were called
      expect(parentDisposable.disposed).toBe(true);
      expect(childDisposable.disposed).toBe(true);
    });

    it('disposes all descendants recursively', () => {
      const root = createScope();
      const child1 = createScope(root);
      const child2 = createScope(root);
      const grandchild = createScope(child1);

      const rootDisposable = createMockDisposable();
      const child1Disposable = createMockDisposable();
      const child2Disposable = createMockDisposable();
      const grandchildDisposable = createMockDisposable();

      trackInSpecificScope(root, rootDisposable);
      trackInSpecificScope(child1, child1Disposable);
      trackInSpecificScope(child2, child2Disposable);
      trackInSpecificScope(grandchild, grandchildDisposable);

      // Dispose root
      disposeScope(root);

      // User cares: entire tree was disposed
      expect(rootDisposable.disposed).toBe(true);
      expect(child1Disposable.disposed).toBe(true);
      expect(child2Disposable.disposed).toBe(true);
      expect(grandchildDisposable.disposed).toBe(true);
    });
  });

  describe('runInScope', () => {
    it('sets currentScope during function execution', () => {
      const ctx = createViewContext();
      const scope = createScope();

      expect(ctx.currentScope).toBeNull();

      runInScope(ctx, scope, () => {
        // Invariant: currentScope is set during execution
        expect(ctx.currentScope).toBe(scope);
      });

      // Invariant: currentScope is restored after execution
      expect(ctx.currentScope).toBeNull();
    });

    it('restores previous scope on nested calls', () => {
      const ctx = createViewContext();
      const scope1 = createScope();
      const scope2 = createScope();

      runInScope(ctx, scope1, () => {
        expect(ctx.currentScope).toBe(scope1);

        runInScope(ctx, scope2, () => {
          // Invariant: Inner scope overrides
          expect(ctx.currentScope).toBe(scope2);
        });

        // Invariant: Outer scope restored
        expect(ctx.currentScope).toBe(scope1);
      });

      expect(ctx.currentScope).toBeNull();
    });

    it('restores scope even when function throws', () => {
      const ctx = createViewContext();
      const scope = createScope();

      expect(() => {
        runInScope(ctx, scope, () => {
          throw new Error('test error');
        });
      }).toThrow('test error');

      // Invariant: Scope restored even on error
      expect(ctx.currentScope).toBeNull();
    });

    it('returns function result', () => {
      const ctx = createViewContext();
      const scope = createScope();

      const result = runInScope(ctx, scope, () => {
        return 42;
      });

      expect(result).toBe(42);
    });
  });

  describe('trackInScope', () => {
    it('disposes tracked items when scope is disposed', () => {
      const ctx = createViewContext();
      const scope = createScope();
      const disposable = createMockDisposable();

      runInScope(ctx, scope, () => {
        trackInScope(ctx, disposable);
      });

      disposeScope(scope);

      // User cares: tracked disposable was called
      expect(disposable.disposed).toBe(true);
    });

    it('does nothing when currentScope is null', () => {
      const ctx = createViewContext();
      const scope = createScope();
      const disposable = createMockDisposable();

      // Track without setting currentScope
      trackInScope(ctx, disposable);

      // Dispose scope
      disposeScope(scope);

      // User cares: disposable was NOT called (wasn't tracked)
      expect(disposable.disposed).toBe(false);
    });

    it('disposes all tracked items', () => {
      const ctx = createViewContext();
      const scope = createScope();
      const d1 = createMockDisposable();
      const d2 = createMockDisposable();
      const d3 = createMockDisposable();

      runInScope(ctx, scope, () => {
        trackInScope(ctx, d1);
        trackInScope(ctx, d2);
        trackInScope(ctx, d3);
      });

      disposeScope(scope);

      // User cares: all tracked disposables were called
      expect(d1.disposed).toBe(true);
      expect(d2.disposed).toBe(true);
      expect(d3.disposed).toBe(true);
    });
  });

  describe('trackInSpecificScope', () => {
    it('disposes tracked item even without currentScope set', () => {
      const scope = createScope();
      const disposable = createMockDisposable();

      // Track directly without setting currentScope
      trackInSpecificScope(scope, disposable);

      disposeScope(scope);

      // User cares: disposable was called even though currentScope wasn't set
      expect(disposable.disposed).toBe(true);
    });

    it('does not track in already-disposed scope', () => {
      const scope = createScope();
      const disposable = createMockDisposable();

      disposeScope(scope);

      // Try to track after disposal
      trackInSpecificScope(scope, disposable);

      // User cares: disposable was never called (scope already disposed)
      expect(disposable.disposed).toBe(false);
    });
  });

  describe('disposeScope', () => {
    it('is idempotent - can dispose same scope multiple times', () => {
      const scope = createScope();
      const disposable = createMockDisposable();

      trackInSpecificScope(scope, disposable);

      // Dispose twice
      disposeScope(scope);
      disposeScope(scope);

      // User cares: disposable only called once
      expect(disposable.dispose).toHaveBeenCalledTimes(1);
    });

    it('prevents tracking after disposal', () => {
      const scope = createScope();
      const beforeDispose = createMockDisposable();
      const afterDispose = createMockDisposable();

      trackInSpecificScope(scope, beforeDispose);
      disposeScope(scope);
      trackInSpecificScope(scope, afterDispose);

      // User cares: only item tracked before disposal was called
      expect(beforeDispose.disposed).toBe(true);
      expect(afterDispose.disposed).toBe(false);
    });

    it('handles errors in dispose functions gracefully', () => {
      const scope = createScope();
      const d1 = createMockDisposable();
      const d2 = { dispose: () => { throw new Error('dispose error'); } };
      const d3 = createMockDisposable();

      trackInSpecificScope(scope, d1);
      trackInSpecificScope(scope, d2);
      trackInSpecificScope(scope, d3);

      // User cares: error is thrown
      expect(() => disposeScope(scope)).toThrow('dispose error');

      // Note: Some disposables may not be called due to error
      // This is acceptable - the error needs to propagate
    });
  });

  describe('integration scenarios', () => {
    it('supports effect cleanup pattern', () => {
      const scope = createScope();
      const subscription = createMockDisposable();

      // Simulate: effect creates a subscription
      trackInSpecificScope(scope, subscription);

      // When element unmounts
      disposeScope(scope);

      // User cares: subscription was cleaned up
      expect(subscription.disposed).toBe(true);
    });

    it('supports partial tree disposal', () => {
      const appScope = createScope();
      const componentScope = createScope(appScope);
      const nestedScope = createScope(componentScope);

      const appCleanup = createMockDisposable();
      const componentCleanup = createMockDisposable();
      const nestedCleanup = createMockDisposable();

      trackInSpecificScope(appScope, appCleanup);
      trackInSpecificScope(componentScope, componentCleanup);
      trackInSpecificScope(nestedScope, nestedCleanup);

      // User unmounts a component subtree
      disposeScope(componentScope);

      // User cares: component tree was disposed
      expect(componentCleanup.disposed).toBe(true);
      expect(nestedCleanup.disposed).toBe(true);

      // User cares: parent scope still works
      expect(appCleanup.disposed).toBe(false);

      // Can still track in parent
      const newCleanup = createMockDisposable();
      trackInSpecificScope(appScope, newCleanup);
      disposeScope(appScope);
      expect(newCleanup.disposed).toBe(true);
    });

    it('handles complex cleanup sequences', () => {
      const ctx = createViewContext();
      const outer = createScope();
      const inner = createScope(outer);

      const outerCleanups: ReturnType<typeof createMockDisposable>[] = [];
      const innerCleanups: ReturnType<typeof createMockDisposable>[] = [];

      // Track multiple items in nested scopes
      runInScope(ctx, outer, () => {
        for (let i = 0; i < 3; i++) {
          const d = createMockDisposable();
          outerCleanups.push(d);
          trackInScope(ctx, d);
        }

        runInScope(ctx, inner, () => {
          for (let i = 0; i < 3; i++) {
            const d = createMockDisposable();
            innerCleanups.push(d);
            trackInScope(ctx, d);
          }
        });
      });

      // Dispose outer (should dispose inner too)
      disposeScope(outer);

      // User cares: all cleanups called
      for (const d of [...outerCleanups, ...innerCleanups]) {
        expect(d.disposed).toBe(true);
      }
    });
  });
});
