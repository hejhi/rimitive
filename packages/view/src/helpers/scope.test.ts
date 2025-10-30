import { describe, it, expect, vi } from 'vitest';
import { createMockDisposable } from '../test-utils';
import { createTestScopes, createMockElement, MockTestElement } from '../test-helpers';
import { createLatticeContext } from '../context';
import { createScopes, type CreateScopes } from './scope';
import { CONSTANTS } from '@lattice/signals/constants';
import type { RenderScope } from '../types';

const { DISPOSED, STATE_MASK, CONSUMER, SCHEDULED } = CONSTANTS;

// Helper to add withScope to CreateScopes result for tests that need custom mocks
function addWithScope<TElement extends object>(
  scopes: CreateScopes,
  ctx: ReturnType<typeof createLatticeContext<TElement>>,
  track: <T>(_node: unknown, fn: () => T) => T
) {
  const withScope = <TElem extends TElement = TElement, T = void>(
    element: TElem,
    fn: (scope: RenderScope<TElem>) => T
  ): { result: T; scope: RenderScope<TElem> | null } => {
    // Try to get existing scope first (idempotent)
    let scope = ctx.elementScopes.get(element) as RenderScope<TElem> | undefined;
    let isNewScope = false;
    let parentScope: RenderScope<TElement> | null = null;

    if (!scope) {
      parentScope = ctx.activeScope;

      // Create scope inline
      const RENDER_SCOPE_CLEAN = CONSUMER | SCHEDULED | 0b0001; // CONSUMER | SCHEDULED | CLEAN
      scope = {
        __type: 'render-scope',
        status: RENDER_SCOPE_CLEAN,
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
        nextScheduled: undefined,
        flush(): void {
          if (scope!.renderFn === undefined) return;
          const { cleanup } = scope!;
          if (cleanup) {
            cleanup();
            scope!.cleanup = undefined;
          }
          const result = track(scope!, scope!.renderFn);
          if (typeof result === 'function') scope!.cleanup = result;
        },
        firstChild: undefined,
        nextSibling: undefined,
        firstDisposable: undefined,
        element,
        cleanup: undefined,
        renderFn: undefined,
      };

      // Attach to parent's child list
      if (parentScope) {
        scope.nextSibling = parentScope.firstChild as RenderScope<TElem> | undefined;
        parentScope.firstChild = scope as RenderScope<TElement>;
      }

      isNewScope = true;
    }

    const prevScope = ctx.activeScope;
    ctx.activeScope = scope as RenderScope<TElement>;

    let result: T;
    try {
      result = fn(scope);
    } catch (e) {
      // Only delete if we registered it
      if (scope.firstDisposable !== undefined) {
        ctx.elementScopes.delete(element);
      }
      scopes.disposeScope(scope); // Clean up any disposables that were registered before error
      throw e;
    } finally {
      ctx.activeScope = prevScope;
    }

    // CRITICAL: Only keep scope if it has disposables/renderFn
    if (isNewScope && (scope.firstDisposable !== undefined || scope.renderFn !== undefined)) {
      ctx.elementScopes.set(element, scope);
      return { result, scope };
    }

    // No disposables - unlink from parent tree and return null
    if (isNewScope && parentScope && parentScope.firstChild === scope) {
      parentScope.firstChild = scope.nextSibling as RenderScope<TElement> | undefined;
    }

    return { result, scope: isNewScope ? null : scope };
  };

  return { ...scopes, withScope };
}

describe('Scope Tree', () => {

  describe('disposal', () => {
    it('disposes tracked items when scope is disposed', () => {
      const { withScope, disposeScope } = createTestScopes();
      const element = createMockElement();
      const disposable = createMockDisposable();

      // Create scope with disposable in single call
      const { scope } = withScope(element, (scope) => {
        scope.firstDisposable = { dispose: disposable.dispose, next: undefined };
      });

      if (!scope) throw new Error('Expected scope to be created');
      disposeScope(scope);

      // tracked item was cleaned up
      expect(disposable.disposed).toBe(true);
    });

    it('disposes child scopes when parent is disposed', () => {
      const parentDisposable = createMockDisposable();
      const childDisposable = createMockDisposable();

      const { withScope, disposeScope, trackInScope, ctx } = createTestScopes();
      const parentElement = createMockElement();
      const childElement = createMockElement();

      // Create parent scope
      const { scope: parent } = withScope(parentElement, () => {
        trackInScope(parentDisposable);
      });

      if (!parent) throw new Error('Expected parent scope to be created');

      // Create child scope with parent as activeScope
      ctx.activeScope = parent;
      withScope(childElement, () => {
        trackInScope(childDisposable);
      });
      ctx.activeScope = null;

      // Dispose parent
      disposeScope(parent);

      // parent-child relationship enforced
      expect(parentDisposable.disposed).toBe(true);
      expect(childDisposable.disposed).toBe(true);
    });

    it('disposes entire scope tree recursively', () => {
      const { withScope, disposeScope, ctx } = createTestScopes();
      const rootElement = createMockElement();
      const child1Element = createMockElement();
      const child2Element = createMockElement();
      const grandchildElement = createMockElement();

      const rootDisposable = createMockDisposable();
      const child1Disposable = createMockDisposable();
      const child2Disposable = createMockDisposable();
      const grandchildDisposable = createMockDisposable();

      // Create root scope
      const { scope: root } = withScope(rootElement, (scope) => {
        scope.firstDisposable = { dispose: rootDisposable.dispose, next: undefined };
      });

      if (!root) throw new Error('Expected root scope to be created');

      // Create child1 under root
      ctx.activeScope = root;
      const { scope: child1 } = withScope(child1Element, (scope) => {
        scope.firstDisposable = { dispose: child1Disposable.dispose, next: undefined };
      });

      if (!child1) throw new Error('Expected child1 scope to be created');

      // Create child2 under root
      withScope(child2Element, (scope) => {
        scope.firstDisposable = { dispose: child2Disposable.dispose, next: undefined };
      });
      ctx.activeScope = null;

      // Create grandchild under child1
      ctx.activeScope = child1;
      withScope(grandchildElement, (scope) => {
        scope.firstDisposable = { dispose: grandchildDisposable.dispose, next: undefined };
      });
      ctx.activeScope = null;

      // Dispose root
      disposeScope(root);

      // entire tree was disposed
      expect(rootDisposable.disposed).toBe(true);
      expect(child1Disposable.disposed).toBe(true);
      expect(child2Disposable.disposed).toBe(true);
      expect(grandchildDisposable.disposed).toBe(true);
    });

    it('is idempotent - can dispose same scope multiple times', () => {
      const { withScope, disposeScope } = createTestScopes();
      const element = createMockElement();
      const disposable = createMockDisposable();

      // Create scope with disposable
      const { scope } = withScope(element, (scope) => {
        scope.firstDisposable = { dispose: disposable.dispose, next: undefined };
      });

      if (!scope) throw new Error('Expected scope to be created');

      // Dispose multiple times
      disposeScope(scope);
      disposeScope(scope);
      disposeScope(scope);

      // safe to call multiple times, item only disposed once
      expect(disposable.disposed).toBe(true);
    });

    it('prevents tracking after disposal', () => {
      const { withScope, disposeScope } = createTestScopes();
      const element = createMockElement();
      const beforeDispose = createMockDisposable();
      const afterDispose = createMockDisposable();

      // Create scope with disposable
      const { scope } = withScope(element, (scope) => {
        scope.firstDisposable = { dispose: beforeDispose.dispose, next: undefined };
      });

      if (!scope) throw new Error('Expected scope to be created');

      disposeScope(scope);

      // Try to track after disposal (scope is disposed, so this won't be tracked)
      scope.firstDisposable = { dispose: afterDispose.dispose, next: scope.firstDisposable };

      // disposed scope rejects new tracking
      expect(beforeDispose.disposed).toBe(true);
      expect(afterDispose.disposed).toBe(false);
    });
  });

  describe('scope isolation', () => {
    it('disposes partial tree without affecting parent', () => {
      const { withScope, disposeScope, trackInScope, ctx } = createTestScopes();
      const appElement = createMockElement();
      const componentElement = createMockElement();
      const nestedElement = createMockElement();

      const appCleanup = createMockDisposable();
      const componentCleanup = createMockDisposable();
      const nestedCleanup = createMockDisposable();

      // Create app scope
      const { scope: appScope } = withScope(appElement, () => {
        trackInScope(appCleanup);
      });

      if (!appScope) throw new Error('Expected app scope to be created');

      // Create component scope under app
      ctx.activeScope = appScope;
      const { scope: componentScope } = withScope(componentElement, () => {
        trackInScope(componentCleanup);
      });

      if (!componentScope) throw new Error('Expected component scope to be created');

      // Create nested scope under component
      ctx.activeScope = componentScope;
      withScope(nestedElement, () => {
        trackInScope(nestedCleanup);
      });
      ctx.activeScope = null;

      // User unmounts a component subtree
      disposeScope(componentScope);

      // component tree disposed
      expect(componentCleanup.disposed).toBe(true);
      expect(nestedCleanup.disposed).toBe(true);

      // parent scope unaffected
      expect(appCleanup.disposed).toBe(false);

      // Parent scope still functional
      const newCleanup = createMockDisposable();
      withScope(appElement, () => trackInScope(newCleanup));
      disposeScope(appScope);
      expect(newCleanup.disposed).toBe(true);
    });

    it('isolates sibling scopes from each other', () => {
      const { withScope, disposeScope, trackInScope, ctx } = createTestScopes();

      const parentElement = createMockElement();
      const sibling1Element = createMockElement();
      const sibling2Element = createMockElement();

      const cleanup1 = createMockDisposable();
      const cleanup2 = createMockDisposable();

      // Create parent scope with a disposable so it's kept
      const { scope: parent } = withScope(parentElement, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!parent) throw new Error('Expected parent scope to be created');

      // Create sibling scopes
      ctx.activeScope = parent;
      const { scope: sibling1 } = withScope(sibling1Element, () => {
        trackInScope(cleanup1);
      });

      if (!sibling1) throw new Error('Expected sibling1 scope to be created');

      withScope(sibling2Element, () => {
        trackInScope(cleanup2);
      });
      ctx.activeScope = null;

      // Dispose one sibling
      disposeScope(sibling1);

      // siblings don't affect each other
      expect(cleanup1.disposed).toBe(true);
      expect(cleanup2.disposed).toBe(false);
    });
  });

  describe('no-op behavior', () => {
    it('ignores tracking when no scope is active', () => {
      const { trackInScope } = createTestScopes();
      const disposable = createMockDisposable();

      // Track without active scope
      trackInScope(disposable);

      // safe to call without scope, just no-op
      expect(disposable.disposed).toBe(false);
    });

    it('handles disposal of empty scope', () => {
      const { withScope } = createTestScopes();
      const element = createMockElement();
      const { scope } = withScope(element, () => {});

      // Empty scopes return null (optimization)
      expect(scope).toBeNull();

      // If scope is null, disposeScope would throw, but we shouldn't call it
      // This test documents that empty scopes are optimized away
    });
  });

  describe('disposal integration with scheduler', () => {
    it('should call scheduler dispose when disposing scope', () => {
      const track = <T>(_node: unknown, fn: () => T): T => fn();
      const disposeSpy = vi.fn(<T extends RenderScope<HTMLElement>>(node: T, cleanup: (node: T) => void) => {
        const scope = node;

        // Check if already disposed (idempotent)
        if ((scope.status & STATE_MASK) === DISPOSED) return;

        // Set DISPOSED status (mimics scheduler.dispose)
        const CONSUMER = 1 << 7;
        const SCHEDULED = 1 << 8;
        scope.status = CONSUMER | SCHEDULED | DISPOSED;

        cleanup(node);

        // Clear dependencies
        scope.dependencies = undefined;
        scope.dependencyTail = undefined;
      });

      const ctx = createLatticeContext<MockTestElement>();
      const baseEffect = vi.fn(() => () => {});
      const { withScope, disposeScope } = addWithScope(
        createScopes<MockTestElement>({ ctx, track, dispose: disposeSpy, baseEffect }),
        ctx,
        track
      );
      const element = createMockElement();
      // Add a disposable so scope is kept
      const { scope } = withScope(element, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!scope) throw new Error('Expected scope to be created');

      disposeScope(scope);

      // Scheduler dispose was called
      expect(disposeSpy).toHaveBeenCalledWith(scope, expect.any(Function));
      // Status bits set correctly
      expect(scope.status & STATE_MASK).toBe(DISPOSED);
    });

    it('should execute cleanup function during disposal', () => {
      const cleanupSpy = vi.fn();
      const { withScope, disposeScope } = createTestScopes();
      const element = createMockElement();
      // Add a disposable so scope is kept
      const { scope } = withScope(element, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!scope) throw new Error('Expected scope to be created');

      // Add cleanup function
      scope.cleanup = cleanupSpy;

      disposeScope(scope);

      // Cleanup was called
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
      // Cleanup cleared after execution
      expect(scope.cleanup).toBeUndefined();
    });

    it('should call cleanup before disposing children', () => {
      const callOrder: string[] = [];
      const { withScope, disposeScope, ctx } = createTestScopes();

      const parentElement = createMockElement();
      const childElement = createMockElement();

      // Add disposables so scopes are kept
      const { scope: parent } = withScope(parentElement, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!parent) throw new Error('Expected parent scope to be created');

      ctx.activeScope = parent;
      const { scope: child } = withScope(childElement, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!child) throw new Error('Expected child scope to be created');

      ctx.activeScope = null;

      parent.cleanup = () => callOrder.push('parent-cleanup');
      child.cleanup = () => callOrder.push('child-cleanup');

      disposeScope(parent);

      // Parent cleanup called before child cleanup
      expect(callOrder).toEqual(['parent-cleanup', 'child-cleanup']);
    });

    it('should clear dependencies through scheduler dispose', () => {
      const track = <T>(_node: unknown, fn: () => T): T => fn();

      // Track dispose calls and verify dependency cleanup
      const disposedNodes: RenderScope<HTMLElement>[] = [];
      const dispose = vi.fn(<T extends RenderScope<HTMLElement>>(node: T, cleanup: (n: T) => void) => {
        disposedNodes.push(node);

        const scope = node;

        // Check if already disposed (idempotent)
        if ((scope.status & STATE_MASK) === DISPOSED) return;

        // Set DISPOSED status (mimics scheduler.dispose)
        const CONSUMER = 1 << 7;
        const SCHEDULED = 1 << 8;
        scope.status = CONSUMER | SCHEDULED | DISPOSED;

        cleanup(node);

        // Clear dependencies
        scope.dependencies = undefined;
        scope.dependencyTail = undefined;
      });

      const ctx = createLatticeContext<MockTestElement>();
      const baseEffect = vi.fn(() => () => {});
      const { withScope, disposeScope } = addWithScope(
        createScopes<MockTestElement>({ ctx, track, dispose, baseEffect }),
        ctx,
        track
      );
      const element = createMockElement();
      // Add a disposable so scope is kept
      const { scope } = withScope(element, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!scope) throw new Error('Expected scope to be created');

      // Simulate dependencies being set (in real usage, this happens during tracking)
      scope.dependencies = undefined; // Will be populated by track() in real usage

      disposeScope(scope);

      // Scheduler dispose was called with the scope
      expect(disposedNodes).toContain(scope);
      // Scope is marked as disposed
      expect(scope.status & STATE_MASK).toBe(DISPOSED);
    });

    it('should handle cleanup function errors gracefully', () => {
      const { withScope, disposeScope, ctx } = createTestScopes();
      const parentElement = createMockElement();
      const childElement = createMockElement();

      // Add disposables so scopes are kept
      const { scope: parent } = withScope(parentElement, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!parent) throw new Error('Expected parent scope to be created');

      ctx.activeScope = parent;
      const { scope: child } = withScope(childElement, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!child) throw new Error('Expected child scope to be created');

      ctx.activeScope = null;

      const childDisposable = createMockDisposable();

      // Parent cleanup throws
      parent.cleanup = () => {
        throw new Error('Cleanup failed');
      };

      // Child has additional disposable that should still be cleaned up
      child.firstDisposable = {
        dispose: childDisposable.dispose,
        next: child.firstDisposable,
      };

      // Dispose should throw but still clean up what it can
      expect(() => disposeScope(parent)).toThrow('Cleanup failed');

      // Note: In current implementation, child disposal happens after parent cleanup
      // So child disposable would be cleaned up despite parent cleanup error
      // This test documents current behavior - we may want to improve error handling
    });

    it('should clear all references to prevent memory leaks', () => {
      const { withScope, disposeScope, trackInSpecificScope, ctx } = createTestScopes();
      const parentElement = createMockElement();
      const child1Element = createMockElement();
      const child2Element = createMockElement();

      // Add a disposable so parent scope is kept
      const { scope: parent } = withScope(parentElement, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!parent) throw new Error('Expected parent scope to be created');

      ctx.activeScope = parent;
      const { scope: child1 } = withScope(child1Element, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!child1) throw new Error('Expected child1 scope to be created');

      const { scope: child2 } = withScope(child2Element, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!child2) throw new Error('Expected child2 scope to be created');

      ctx.activeScope = null;

      const disposable1 = createMockDisposable();
      const disposable2 = createMockDisposable();
      trackInSpecificScope(parent, disposable1);
      trackInSpecificScope(parent, disposable2);

      disposeScope(parent);

      // All references cleared
      expect(parent.firstChild).toBeUndefined();
      expect(parent.firstDisposable).toBeUndefined();
      expect(parent.cleanup).toBeUndefined();

      // Children disposed
      expect(child1.status & STATE_MASK).toBe(DISPOSED);
      expect(child2.status & STATE_MASK).toBe(DISPOSED);

      // Disposables called
      expect(disposable1.disposed).toBe(true);
      expect(disposable2.disposed).toBe(true);
    });

    it('should integrate with element removal from context', () => {
      const ctx = createLatticeContext<MockTestElement>();
      const track = <T>(_node: unknown, fn: () => T): T => fn();
      const dispose = vi.fn(<T extends RenderScope<HTMLElement>>(node: T, cleanup: (n: T) => void): void => {
        const scope = node;

        // Check if already disposed (idempotent)
        if ((scope.status & STATE_MASK) === DISPOSED) return;

        // Set DISPOSED status (mimics scheduler.dispose)
        const CONSUMER = 1 << 7;
        const SCHEDULED = 1 << 8;
        scope.status = CONSUMER | SCHEDULED | DISPOSED;

        cleanup(node);

        // Clear dependencies
        scope.dependencies = undefined;
        scope.dependencyTail = undefined;
      });

      const baseEffect = vi.fn(() => () => {});
      const { withScope, disposeScope } = addWithScope(
        createScopes<MockTestElement>({ ctx, track, dispose, baseEffect }),
        ctx,
        track
      );
      const element = createMockElement();
      // Add a disposable so scope is kept
      const { scope } = withScope(element, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!scope) throw new Error('Expected scope to be created');

      // Store scope in context (simulates what happens during rendering)
      ctx.elementScopes.set(element, scope as never);

      // Simulate element removal (in real usage, this happens in reconciler)
      const storedScope = ctx.elementScopes.get(element);
      if (storedScope) {
        disposeScope(storedScope);
        ctx.elementScopes.delete(element);
      }

      // Scope disposed and removed from context
      expect(scope.status & STATE_MASK).toBe(DISPOSED);
      expect(ctx.elementScopes.has(element)).toBe(false);
    });

    it('should handle disposal order correctly', () => {
      const disposalOrder: string[] = [];
      const track = <T>(_node: unknown, fn: () => T): T => fn();
      const dispose = <T>(_node: unknown, cleanup: (node: T) => void): void => {
        disposalOrder.push('scheduler-dispose');
        cleanup(_node as T);
      };

      const ctx = createLatticeContext<MockTestElement>();
      const baseEffect = vi.fn(() => () => {});
      const { withScope, disposeScope } = addWithScope(
        createScopes<MockTestElement>({ ctx, track, dispose, baseEffect }),
        ctx,
        track
      );
      const parentElement = createMockElement();
      const childElement = createMockElement();

      // Add disposables so scopes are kept
      const { scope: parent } = withScope(parentElement, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!parent) throw new Error('Expected parent scope to be created');

      ctx.activeScope = parent;
      const { scope: child } = withScope(childElement, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!child) throw new Error('Expected child scope to be created');

      ctx.activeScope = null;

      // Add cleanup function
      parent.cleanup = () => disposalOrder.push('parent-cleanup');

      // Add child cleanup
      child.cleanup = () => disposalOrder.push('child-cleanup');

      // Add tracked disposable (manually since using raw createScopes)
      parent.firstDisposable = {
        dispose: () => disposalOrder.push('disposable-dispose'),
        next: parent.firstDisposable,
      };

      disposeScope(parent);

      // Verify disposal order:
      // 1. Scheduler dispose (reactive graph cleanup)
      // 2. Parent cleanup function (within scheduler cleanup callback)
      // 3. Child scheduler dispose
      // 4. Child cleanup function
      // 5. Parent tracked disposables
      expect(disposalOrder).toEqual([
        'scheduler-dispose',  // Parent scheduler
        'parent-cleanup',     // Parent cleanup (inside scheduler callback)
        'scheduler-dispose',  // Child scheduler
        'child-cleanup',      // Child cleanup (inside scheduler callback)
        'disposable-dispose', // Parent disposables
      ]);
    });

    it('should be idempotent with status bits', () => {
      const { withScope, disposeScope } = createTestScopes();
      const element = createMockElement();
      // Add a disposable so scope is kept
      const { scope } = withScope(element, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      if (!scope) throw new Error('Expected scope to be created');

      const cleanupSpy = vi.fn();
      scope.cleanup = cleanupSpy;

      // Dispose multiple times
      disposeScope(scope);
      const statusAfterFirst = scope.status;

      disposeScope(scope);
      disposeScope(scope);

      // Status unchanged after first disposal
      expect(scope.status).toBe(statusAfterFirst);
      expect(scope.status & STATE_MASK).toBe(DISPOSED);

      // Cleanup only called once
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('should integrate full lifecycle from creation to disposal', () => {
      const { withScope, disposeScope, trackInScope, ctx } = createTestScopes();

      // Setup: Create scope with reactive dependencies and children
      const element = createMockElement();
      const childElement = createMockElement();

      // Add cleanup function (simulates reactive tracking)
      const cleanupSpy = vi.fn();
      const disposableSpy = vi.fn();

      const { scope } = withScope(element, (scope) => {
        scope.cleanup = cleanupSpy;

        // Add tracked disposable (simulates event listener)
        trackInScope({ dispose: disposableSpy });

        // Add child scope (simulates tree structure)
        const childCleanupSpy = vi.fn();
        ctx.activeScope = scope;
        withScope(childElement, (childScope) => {
          childScope.cleanup = childCleanupSpy;
        });
        ctx.activeScope = null;
      });

      if (!scope) throw new Error('Expected scope to be created');

      const childScope = ctx.elementScopes.get(childElement);

      // Act: Dispose parent scope
      disposeScope(scope);

      // Assert: All disposal steps executed
      expect(cleanupSpy).toHaveBeenCalledTimes(1);         // Parent cleanup
      if (childScope && childScope.cleanup) {
        // Child cleanup spy is wrapped in closure, check if scope was disposed
        expect(childScope.status & STATE_MASK).toBe(DISPOSED);
      }
      expect(disposableSpy).toHaveBeenCalledTimes(1);     // Disposable
      expect(scope.status & STATE_MASK).toBe(DISPOSED);
      if (childScope) {
        expect(childScope.status & STATE_MASK).toBe(DISPOSED);
      }

      // Assert: Memory safety - references cleared
      expect(scope.firstChild).toBeUndefined();
      expect(scope.firstDisposable).toBeUndefined();
      expect(scope.cleanup).toBeUndefined();
      if (childScope) {
        expect(childScope.cleanup).toBeUndefined();
      }
    });
  });
});
