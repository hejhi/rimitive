import { describe, it, expect } from 'vitest';
import { createTestEnv, MockElement } from '../test-utils';
import type { RenderScope } from '../types';

describe('with-scope', () => {
  describe('createWithScope', () => {
    it('should create scope, run code, but NOT register if no disposables', () => {
      const env = createTestEnv();
      const { ctx, withScope } = env;

      const element = new MockElement('div');
      let didRun = false;

      const { result, scope } = withScope(element, () => {
        didRun = true;
        return 42;
      });

      expect(didRun).toBe(true);
      expect(result).toBe(42);
      expect(scope).toBeDefined();

      // Scope should NOT be registered (performance optimization - no disposables)
      expect(ctx.elementScopes.get(element)).toBeUndefined();
    });

    it('should keep scope registered if it has disposables', () => {
      const env = createTestEnv();
      const { ctx, withScope } = env;

      const element = new MockElement('div');

      const { scope } = withScope(element, (scope) => {
        // Add a disposable manually
        scope.firstDisposable = {
          dispose: () => {},
          next: undefined,
        };
      });

      // Scope should remain registered
      expect(ctx.elementScopes.get(element)).toBe(scope);
    });

    it('should keep scope registered if it has renderFn', () => {
      const env = createTestEnv();
      const { ctx, withScope } = env;

      const element = new MockElement('div');

      // Create a scope and manually add renderFn to test this internal behavior
      const { scope } = withScope(element, (scope) => {
        // Manually add renderFn to test internal behavior
        scope.renderFn = () => {
          // Provide a renderFn
        };
      });

      if (!scope) throw new Error('Expected scope to be created');

      // Scope should remain registered (has renderFn)
      expect(ctx.elementScopes.get(element)).toBe(scope);
      expect(scope.renderFn).toBeDefined();
    });

    it('should set activeScope during execution', () => {
      const env = createTestEnv();
      const { ctx, withScope } = env;

      const element = new MockElement('div');
      let capturedScope: RenderScope<object> | null = null;

      withScope(element, (scope) => {
        capturedScope = ctx.activeScope;
        expect(ctx.activeScope).toBe(scope);
      });

      expect(capturedScope).toBeDefined();
      // Should be restored
      expect(ctx.activeScope).toBe(null);
    });

    it('should restore previous activeScope', () => {
      const env = createTestEnv();
      const { ctx, withScope } = env;

      const prevElement = new MockElement('span');
      const { scope: prevScope } = withScope(prevElement, () => {});
      ctx.activeScope = prevScope;

      const element = new MockElement('div');

      withScope(element, (scope) => {
        expect(ctx.activeScope).toBe(scope);
        expect(ctx.activeScope).not.toBe(prevScope);
      });

      // Should restore
      expect(ctx.activeScope).toBe(prevScope);
    });

    it('should handle nested withScope calls', () => {
      const env = createTestEnv();
      const { ctx, withScope } = env;

      const parent = new MockElement('div');
      const child = new MockElement('span');

      withScope(parent, (parentScope) => {
        expect(ctx.activeScope).toBe(parentScope);

        withScope(child, (childScope) => {
          expect(ctx.activeScope).toBe(childScope);
          expect(childScope).not.toBe(parentScope);
        });

        // Should restore parent scope
        expect(ctx.activeScope).toBe(parentScope);
      });

      // Should restore original (null)
      expect(ctx.activeScope).toBe(null);
    });

    it('should use activeScope as parent for automatic hierarchy', () => {
      const env = createTestEnv();
      const { ctx, withScope } = env;

      const parentElement = new MockElement('div');
      // Add a disposable so parent scope is kept
      const { scope: parentScope } = withScope(parentElement, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });

      const childElement = new MockElement('span');

      // Set as activeScope - withScope should use it as parent
      ctx.activeScope = parentScope;
      // Add a disposable so child scope is kept
      const { scope: childScope } = withScope(childElement, (scope) => {
        scope.firstDisposable = { dispose: () => {}, next: undefined };
      });
      ctx.activeScope = null;

      if (!parentScope) throw new Error('Expected parent scope to be created');
      if (!childScope) throw new Error('Expected child scope to be created');

      // Verify child is linked into parent's child list
      expect(parentScope.firstChild).toBe(childScope);
    });

    it('should be idempotent - reuse scope if called again with same element (when registered)', () => {
      const env = createTestEnv();
      const { ctx, withScope } = env;

      const element = new MockElement('div');
      let firstCallCount = 0;
      let secondCallCount = 0;

      // First call creates scope with disposable (so it gets registered)
      const { scope: scope1 } = withScope(element, (scope) => {
        firstCallCount++;
        // Add disposable so scope gets registered
        scope.firstDisposable = {
          dispose: () => {},
          next: undefined,
        };
        return 'first';
      });

      // Second call should reuse the same scope (because it was registered)
      const { scope: scope2 } = withScope(element, () => {
        secondCallCount++;
        return 'second';
      });

      expect(scope1).toBe(scope2); // Same scope instance
      expect(firstCallCount).toBe(1);
      expect(secondCallCount).toBe(1);
      expect(ctx.elementScopes.get(element)).toBe(scope1);
    });
  });

  describe('integration: withScope + auto-tracking', () => {
    it('should enable automatic disposal tracking pattern', () => {
      const env = createTestEnv();
      const { ctx, signal, disposeScope, withScope } = env;

      // Simulate creating an element with reactive props
      const element = new MockElement('div');
      const count = signal(0);
      let runCount = 0;

      const { scope } = withScope(element, () => {
        // This would normally be done by scopedEffect
        // but we'll manually track to show the pattern works
        const dispose = env.effect(() => {
          count();
          runCount++;
        });

        // Manually track (scopedEffect would do this automatically)
        if (ctx.activeScope) {
          ctx.activeScope.firstDisposable = {
            dispose,
            next: ctx.activeScope.firstDisposable,
          };
        }
      });

      if (!scope) throw new Error('Expected scope to be created');

      expect(runCount).toBe(1);
      expect(ctx.elementScopes.get(element)).toBe(scope);

      count(1);
      expect(runCount).toBe(2);

      // Dispose the scope
      disposeScope(scope);

      count(2);
      expect(runCount).toBe(2); // Stopped
    });
  });
});
