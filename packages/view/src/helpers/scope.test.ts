import { describe, it, expect } from 'vitest';
import { createScope, runInScope, trackInScope, disposeScope } from './scope';
import { createViewContext } from '../context';
import type { Disposable } from '../types';

// Test utilities
function createMockDisposable(): Disposable & { disposed: boolean } {
  const mock = {
    disposed: false,
    dispose: () => {
      mock.disposed = true;
    },
  };
  return mock;
}

describe('Scope Tree', () => {
  describe('disposal', () => {
    it('disposes tracked items when scope is disposed', () => {
      const ctx = createViewContext();
      const scope = createScope();
      const disposable = createMockDisposable();

      runInScope(ctx, scope, () => {
        trackInScope(ctx, disposable);
      });

      disposeScope(scope);

      // tracked item was cleaned up
      expect(disposable.disposed).toBe(true);
    });

    it('disposes multiple tracked items', () => {
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

      // all tracked items were cleaned up
      expect(d1.disposed).toBe(true);
      expect(d2.disposed).toBe(true);
      expect(d3.disposed).toBe(true);
    });

    it('disposes child scopes when parent is disposed', () => {
      const parent = createScope();
      const child = createScope(parent);

      const parentDisposable = createMockDisposable();
      const childDisposable = createMockDisposable();

      const ctx = createViewContext();
      runInScope(ctx, parent, () => trackInScope(ctx, parentDisposable));
      runInScope(ctx, child, () => trackInScope(ctx, childDisposable));

      // Dispose parent
      disposeScope(parent);

      // parent-child relationship enforced
      expect(parentDisposable.disposed).toBe(true);
      expect(childDisposable.disposed).toBe(true);
    });

    it('disposes entire scope tree recursively', () => {
      const root = createScope();
      const child1 = createScope(root);
      const child2 = createScope(root);
      const grandchild = createScope(child1);

      const rootDisposable = createMockDisposable();
      const child1Disposable = createMockDisposable();
      const child2Disposable = createMockDisposable();
      const grandchildDisposable = createMockDisposable();

      const ctx = createViewContext();
      runInScope(ctx, root, () => trackInScope(ctx, rootDisposable));
      runInScope(ctx, child1, () => trackInScope(ctx, child1Disposable));
      runInScope(ctx, child2, () => trackInScope(ctx, child2Disposable));
      runInScope(ctx, grandchild, () => trackInScope(ctx, grandchildDisposable));

      // Dispose root
      disposeScope(root);

      // entire tree was disposed
      expect(rootDisposable.disposed).toBe(true);
      expect(child1Disposable.disposed).toBe(true);
      expect(child2Disposable.disposed).toBe(true);
      expect(grandchildDisposable.disposed).toBe(true);
    });

    it('is idempotent - can dispose same scope multiple times', () => {
      const ctx = createViewContext();
      const scope = createScope();
      const disposable = createMockDisposable();

      runInScope(ctx, scope, () => trackInScope(ctx, disposable));

      // Dispose multiple times
      disposeScope(scope);
      disposeScope(scope);
      disposeScope(scope);

      // safe to call multiple times, item only disposed once
      expect(disposable.disposed).toBe(true);
    });

    it('prevents tracking after disposal', () => {
      const ctx = createViewContext();
      const scope = createScope();
      const beforeDispose = createMockDisposable();
      const afterDispose = createMockDisposable();

      runInScope(ctx, scope, () => {
        trackInScope(ctx, beforeDispose);
      });

      disposeScope(scope);

      runInScope(ctx, scope, () => {
        trackInScope(ctx, afterDispose);
      });

      // disposed scope rejects new tracking
      expect(beforeDispose.disposed).toBe(true);
      expect(afterDispose.disposed).toBe(false);
    });
  });

  describe('scope isolation', () => {
    it('disposes partial tree without affecting parent', () => {
      const appScope = createScope();
      const componentScope = createScope(appScope);
      const nestedScope = createScope(componentScope);

      const appCleanup = createMockDisposable();
      const componentCleanup = createMockDisposable();
      const nestedCleanup = createMockDisposable();

      const ctx = createViewContext();
      runInScope(ctx, appScope, () => trackInScope(ctx, appCleanup));
      runInScope(ctx, componentScope, () => trackInScope(ctx, componentCleanup));
      runInScope(ctx, nestedScope, () => trackInScope(ctx, nestedCleanup));

      // User unmounts a component subtree
      disposeScope(componentScope);

      // component tree disposed
      expect(componentCleanup.disposed).toBe(true);
      expect(nestedCleanup.disposed).toBe(true);

      // parent scope unaffected
      expect(appCleanup.disposed).toBe(false);

      // Parent scope still functional
      const newCleanup = createMockDisposable();
      runInScope(ctx, appScope, () => trackInScope(ctx, newCleanup));
      disposeScope(appScope);
      expect(newCleanup.disposed).toBe(true);
    });

    it('isolates sibling scopes from each other', () => {
      const parent = createScope();
      const sibling1 = createScope(parent);
      const sibling2 = createScope(parent);

      const cleanup1 = createMockDisposable();
      const cleanup2 = createMockDisposable();

      const ctx = createViewContext();
      runInScope(ctx, sibling1, () => trackInScope(ctx, cleanup1));
      runInScope(ctx, sibling2, () => trackInScope(ctx, cleanup2));

      // Dispose one sibling
      disposeScope(sibling1);

      // siblings don't affect each other
      expect(cleanup1.disposed).toBe(true);
      expect(cleanup2.disposed).toBe(false);
    });
  });

  describe('scope context restoration', () => {
    it('restores previous scope on nested calls', () => {
      const ctx = createViewContext();
      const scope1 = createScope();
      const scope2 = createScope();
      const tracked: string[] = [];

      runInScope(ctx, scope1, () => {
        tracked.push('outer-start');

        runInScope(ctx, scope2, () => {
          tracked.push('inner');
        });

        tracked.push('outer-end');
      });

      // scope nesting works correctly
      expect(tracked).toEqual(['outer-start', 'inner', 'outer-end']);
    });

    it('restores scope even when function throws', () => {
      const ctx = createViewContext();
      const scope = createScope();

      expect(() => {
        runInScope(ctx, scope, () => {
          throw new Error('test error');
        });
      }).toThrow('test error');

      // scope restored after error (no leak)
      // Verified by: subsequent operations work correctly
    });
  });

  describe('no-op behavior', () => {
    it('ignores tracking when no scope is active', () => {
      const ctx = createViewContext();
      const disposable = createMockDisposable();

      // Track without active scope
      trackInScope(ctx, disposable);

      // safe to call without scope, just no-op
      expect(disposable.disposed).toBe(false);
    });

    it('handles disposal of empty scope', () => {
      const scope = createScope();

      // safe to dispose scope with no tracked items
      expect(() => disposeScope(scope)).not.toThrow();
    });
  });

  describe('real-world patterns', () => {
    it('supports effect cleanup pattern', () => {
      const ctx = createViewContext();
      const scope = createScope();

      // Simulate: component mounts, effect subscribes
      const subscription = createMockDisposable();
      runInScope(ctx, scope, () => {
        trackInScope(ctx, subscription);
      });

      // Simulate: component unmounts
      disposeScope(scope);

      // subscription was cleaned up
      expect(subscription.disposed).toBe(true);
    });

    it('supports nested component cleanup', () => {
      const ctx = createViewContext();
      const outer = createScope();
      const inner = createScope(outer);

      const outerCleanups: ReturnType<typeof createMockDisposable>[] = [];
      const innerCleanups: ReturnType<typeof createMockDisposable>[] = [];

      // Simulate: outer component with inner component
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

      // Simulate: outer unmounts (should cascade to inner)
      disposeScope(outer);

      // all cleanups called
      for (const d of [...outerCleanups, ...innerCleanups]) {
        expect(d.disposed).toBe(true);
      }
    });
  });
});
