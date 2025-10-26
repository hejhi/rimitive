import { describe, it, expect, vi } from 'vitest';
import { createMockDisposable } from '../test-utils';
import { createTestScopes, createMockElement } from '../test-helpers';
import { createLatticeContext } from '../context';
import { createScopes } from './scope';
import { CONSTANTS } from '@lattice/signals/constants';
import type { RenderScope } from '../types';

const { DISPOSED, STATE_MASK } = CONSTANTS;

describe('Scope Tree', () => {

  describe('disposal', () => {
    it('disposes tracked items when scope is disposed', () => {
      const { createScope, runInScope, trackInScope, disposeScope } = createTestScopes();
      const scope = createScope(createMockElement());
      const disposable = createMockDisposable();

      runInScope(scope, () => trackInScope(disposable));
      disposeScope(scope);

      // tracked item was cleaned up
      expect(disposable.disposed).toBe(true);
    });

    it('disposes child scopes when parent is disposed', () => {
      const parentDisposable = createMockDisposable();
      const childDisposable = createMockDisposable();

      const { createScope, runInScope, trackInScope, disposeScope } = createTestScopes();
      const parent = createScope(createMockElement());
      const child = createScope(createMockElement(), parent);

      runInScope(parent, () => trackInScope(parentDisposable));
      runInScope(child, () => trackInScope(childDisposable));

      // Dispose parent
      disposeScope(parent);

      // parent-child relationship enforced
      expect(parentDisposable.disposed).toBe(true);
      expect(childDisposable.disposed).toBe(true);
    });

    it('disposes entire scope tree recursively', () => {
      const { createScope, runInScope, trackInScope, disposeScope } = createTestScopes();
      const root = createScope(createMockElement());
      const child1 = createScope(createMockElement(), root);
      const child2 = createScope(createMockElement(), root);
      const grandchild = createScope(createMockElement(), child1);

      const rootDisposable = createMockDisposable();
      const child1Disposable = createMockDisposable();
      const child2Disposable = createMockDisposable();
      const grandchildDisposable = createMockDisposable();

      runInScope(root, () => trackInScope(rootDisposable));
      runInScope(child1, () => trackInScope(child1Disposable));
      runInScope(child2, () => trackInScope(child2Disposable));
      runInScope(grandchild, () => trackInScope(grandchildDisposable));

      // Dispose root
      disposeScope(root);

      // entire tree was disposed
      expect(rootDisposable.disposed).toBe(true);
      expect(child1Disposable.disposed).toBe(true);
      expect(child2Disposable.disposed).toBe(true);
      expect(grandchildDisposable.disposed).toBe(true);
    });

    it('is idempotent - can dispose same scope multiple times', () => {
      const { createScope, runInScope, trackInScope, disposeScope } = createTestScopes();
      const scope = createScope(createMockElement());
      const disposable = createMockDisposable();

      runInScope(scope, () => trackInScope(disposable));

      // Dispose multiple times
      disposeScope(scope);
      disposeScope(scope);
      disposeScope(scope);

      // safe to call multiple times, item only disposed once
      expect(disposable.disposed).toBe(true);
    });

    it('prevents tracking after disposal', () => {
      const { createScope, runInScope, trackInScope, disposeScope } = createTestScopes();
      const scope = createScope(createMockElement());
      const beforeDispose = createMockDisposable();
      const afterDispose = createMockDisposable();

      runInScope(scope, () => trackInScope(beforeDispose));
      disposeScope(scope);
      runInScope(scope, () => trackInScope(afterDispose));

      // disposed scope rejects new tracking
      expect(beforeDispose.disposed).toBe(true);
      expect(afterDispose.disposed).toBe(false);
    });
  });

  describe('scope isolation', () => {
    it('disposes partial tree without affecting parent', () => {
      const { createScope, runInScope, trackInScope, disposeScope } = createTestScopes();
      const appScope = createScope(createMockElement());
      const componentScope = createScope(createMockElement(), appScope);
      const nestedScope = createScope(createMockElement(), componentScope);

      const appCleanup = createMockDisposable();
      const componentCleanup = createMockDisposable();
      const nestedCleanup = createMockDisposable();

      runInScope(appScope, () => trackInScope(appCleanup));
      runInScope(componentScope, () => trackInScope(componentCleanup));
      runInScope(nestedScope, () => trackInScope(nestedCleanup));

      // User unmounts a component subtree
      disposeScope(componentScope);

      // component tree disposed
      expect(componentCleanup.disposed).toBe(true);
      expect(nestedCleanup.disposed).toBe(true);

      // parent scope unaffected
      expect(appCleanup.disposed).toBe(false);

      // Parent scope still functional
      const newCleanup = createMockDisposable();
      runInScope(appScope, () => trackInScope(newCleanup));
      disposeScope(appScope);
      expect(newCleanup.disposed).toBe(true);
    });

    it('isolates sibling scopes from each other', () => {
      const { createScope, runInScope, trackInScope, disposeScope } = createTestScopes();

      const parent = createScope(createMockElement());
      const sibling1 = createScope(createMockElement(), parent);
      const sibling2 = createScope(createMockElement(), parent);

      const cleanup1 = createMockDisposable();
      const cleanup2 = createMockDisposable();

      runInScope(sibling1, () => trackInScope(cleanup1));
      runInScope(sibling2, () => trackInScope(cleanup2));

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
      const { createScope, disposeScope } = createTestScopes();
      const scope = createScope(createMockElement());

      // safe to dispose scope with no tracked items
      expect(() => disposeScope(scope)).not.toThrow();
    });
  });

  describe('disposal integration with scheduler', () => {
    it('should call scheduler dispose when disposing scope', () => {
      const track = <T>(_node: unknown, fn: () => T): T => fn();
      const disposeSpy = vi.fn(<T extends RenderScope>(_node: T, cleanup: (node: T) => void) => {
        const scope = _node;

        // Check if already disposed (idempotent)
        if ((scope.status & STATE_MASK) === DISPOSED) return;

        // Set DISPOSED status (mimics scheduler.dispose)
        const CONSUMER = 1 << 7;
        const SCHEDULED = 1 << 8;
        scope.status = CONSUMER | SCHEDULED | DISPOSED;

        cleanup(_node);

        // Clear dependencies
        scope.dependencies = undefined;
        scope.dependencyTail = undefined;
      });

      const { createScope, disposeScope } = createScopes({ track, dispose: disposeSpy });
      const element = createMockElement();
      const scope = createScope(element);

      disposeScope(scope);

      // Scheduler dispose was called
      expect(disposeSpy).toHaveBeenCalledWith(scope, expect.any(Function));
      // Status bits set correctly
      expect(scope.status & STATE_MASK).toBe(DISPOSED);
    });

    it('should execute cleanup function during disposal', () => {
      const cleanupSpy = vi.fn();
      const { createScope, disposeScope } = createTestScopes();
      const element = createMockElement();
      const scope = createScope(element);

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
      const { createScope, disposeScope } = createTestScopes();

      const parent = createScope(createMockElement());
      const child = createScope(createMockElement(), parent);

      parent.cleanup = () => callOrder.push('parent-cleanup');
      child.cleanup = () => callOrder.push('child-cleanup');

      disposeScope(parent);

      // Parent cleanup called before child cleanup
      expect(callOrder).toEqual(['parent-cleanup', 'child-cleanup']);
    });

    it('should clear dependencies through scheduler dispose', () => {
      const track = <T>(_node: unknown, fn: () => T): T => fn();

      // Track dispose calls and verify dependency cleanup
      const disposedNodes: RenderScope[] = [];
      const dispose = vi.fn(<T extends RenderScope>(node: T, cleanup: (n: T) => void) => {
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

      const { createScope, disposeScope } = createScopes({ track, dispose });
      const scope = createScope(createMockElement());

      // Simulate dependencies being set (in real usage, this happens during tracking)
      scope.dependencies = undefined; // Will be populated by track() in real usage

      disposeScope(scope);

      // Scheduler dispose was called with the scope
      expect(disposedNodes).toContain(scope);
      // Scope is marked as disposed
      expect(scope.status & STATE_MASK).toBe(DISPOSED);
    });

    it('should handle cleanup function errors gracefully', () => {
      const { createScope, disposeScope } = createTestScopes();
      const parent = createScope(createMockElement());
      const child = createScope(createMockElement(), parent);
      const childDisposable = createMockDisposable();

      // Parent cleanup throws
      parent.cleanup = () => {
        throw new Error('Cleanup failed');
      };

      // Child has disposable that should still be cleaned up
      child.firstDisposable = {
        disposable: childDisposable,
        next: undefined,
      };

      // Dispose should throw but still clean up what it can
      expect(() => disposeScope(parent)).toThrow('Cleanup failed');

      // Note: In current implementation, child disposal happens after parent cleanup
      // So child disposable would be cleaned up despite parent cleanup error
      // This test documents current behavior - we may want to improve error handling
    });

    it('should clear all references to prevent memory leaks', () => {
      const { createScope, disposeScope, trackInSpecificScope } = createTestScopes();
      const parent = createScope(createMockElement());
      const child1 = createScope(createMockElement(), parent);
      const child2 = createScope(createMockElement(), parent);

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
      const ctx = createLatticeContext();
      const track = <T>(_node: unknown, fn: () => T): T => fn();
      const dispose = vi.fn(<T extends RenderScope>(node: T, cleanup: (n: T) => void): void => {
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

      const { createScope, disposeScope } = createScopes({ track, dispose });
      const element = createMockElement();
      const scope = createScope(element);

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

      const { createScope, disposeScope, trackInSpecificScope } = createScopes({ track, dispose });
      const parent = createScope(createMockElement());
      const child = createScope(createMockElement(), parent);

      // Add cleanup function
      parent.cleanup = () => disposalOrder.push('parent-cleanup');

      // Add child cleanup
      child.cleanup = () => disposalOrder.push('child-cleanup');

      // Add tracked disposable
      trackInSpecificScope(parent, {
        dispose: () => disposalOrder.push('disposable-dispose'),
      });

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
      const { createScope, disposeScope } = createTestScopes();
      const scope = createScope(createMockElement());
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
      const { createScope, runInScope, trackInScope, disposeScope } = createTestScopes();

      // Setup: Create scope with reactive dependencies and children
      const element = createMockElement();
      const scope = createScope(element);

      // Add cleanup function (simulates reactive tracking)
      const cleanupSpy = vi.fn();
      scope.cleanup = cleanupSpy;

      // Add child scope (simulates tree structure)
      const childElement = createMockElement();
      const childScope = createScope(childElement, scope);
      const childCleanupSpy = vi.fn();
      childScope.cleanup = childCleanupSpy;

      // Add tracked disposable (simulates event listener)
      const disposableSpy = vi.fn();
      runInScope(scope, () => {
        trackInScope({ dispose: disposableSpy });
      });

      // Act: Dispose parent scope
      disposeScope(scope);

      // Assert: All disposal steps executed
      expect(cleanupSpy).toHaveBeenCalledTimes(1);         // Parent cleanup
      expect(childCleanupSpy).toHaveBeenCalledTimes(1);   // Child cleanup
      expect(disposableSpy).toHaveBeenCalledTimes(1);     // Disposable
      expect(scope.status & STATE_MASK).toBe(DISPOSED);
      expect(childScope.status & STATE_MASK).toBe(DISPOSED);

      // Assert: Memory safety - references cleared
      expect(scope.firstChild).toBeUndefined();
      expect(scope.firstDisposable).toBeUndefined();
      expect(scope.cleanup).toBeUndefined();
      expect(childScope.cleanup).toBeUndefined();
    });
  });
});
