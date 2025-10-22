import { describe, it, expect } from 'vitest';
import { createScopes } from './scope';
import { createViewContext } from '../context';
import { createMockDisposable } from '../test-utils';

describe('Scope Tree', () => {
  
  describe('disposal', () => {
    it('disposes tracked items when scope is disposed', () => {
      const ctx = createViewContext();
      const { createScope, runInScope, trackInScope, disposeScope } = createScopes({ ctx });
      const scope = createScope();
      const disposable = createMockDisposable();

      runInScope(scope, () => trackInScope(disposable));
      disposeScope(scope);

      // tracked item was cleaned up
      expect(disposable.disposed).toBe(true);
    });

    it('disposes child scopes when parent is disposed', () => {
      const parentDisposable = createMockDisposable();
      const childDisposable = createMockDisposable();

      const ctx = createViewContext();
      const { createScope, runInScope, trackInScope, disposeScope } = createScopes({ ctx });
      const parent = createScope();
      const child = createScope(parent);

      runInScope(parent, () => trackInScope(parentDisposable));
      runInScope(child, () => trackInScope(childDisposable));

      // Dispose parent
      disposeScope(parent);

      // parent-child relationship enforced
      expect(parentDisposable.disposed).toBe(true);
      expect(childDisposable.disposed).toBe(true);
    });

    it('disposes entire scope tree recursively', () => {
      const ctx = createViewContext();
      const { createScope, runInScope, trackInScope, disposeScope } = createScopes({ ctx });
      const root = createScope();
      const child1 = createScope(root);
      const child2 = createScope(root);
      const grandchild = createScope(child1);

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
      const ctx = createViewContext();
      const { createScope, runInScope, trackInScope, disposeScope } = createScopes({ ctx });
      const scope = createScope();
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
      const ctx = createViewContext();
      const { createScope, runInScope, trackInScope, disposeScope } = createScopes({ ctx });
      const scope = createScope();
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
      const ctx = createViewContext();
      const { createScope, runInScope, trackInScope, disposeScope } = createScopes({ ctx });
      const appScope = createScope();
      const componentScope = createScope(appScope);
      const nestedScope = createScope(componentScope);

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
      const ctx = createViewContext();
      const { createScope, runInScope, trackInScope, disposeScope } = createScopes({ ctx });

      const parent = createScope();
      const sibling1 = createScope(parent);
      const sibling2 = createScope(parent);

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
      const ctx = createViewContext();
      const { trackInScope } = createScopes({ ctx });
      const disposable = createMockDisposable();

      // Track without active scope
      trackInScope(disposable);

      // safe to call without scope, just no-op
      expect(disposable.disposed).toBe(false);
    });

    it('handles disposal of empty scope', () => {
      const ctx = createViewContext();
      const { createScope, disposeScope } = createScopes({ ctx });
      const scope = createScope();

      // safe to dispose scope with no tracked items
      expect(() => disposeScope(scope)).not.toThrow();
    });
  });
});
