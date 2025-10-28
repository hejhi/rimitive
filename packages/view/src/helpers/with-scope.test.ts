import { describe, it, expect } from 'vitest';
import { createTestEnv } from '../test-utils';
import type { RenderScope } from '../types';

describe('with-scope', () => {
  describe('createWithScope', () => {
    it('should create and register scope, run code, then cleanup if empty', () => {
      const env = createTestEnv();
      const { ctx, withScope } = env;

      const element = {};
      let didRun = false;

      const { result, scope } = withScope(element, () => {
        didRun = true;
        return 42;
      });

      expect(didRun).toBe(true);
      expect(result).toBe(42);
      expect(scope).toBeDefined();

      // Scope should be cleaned up since no disposables
      expect(ctx.elementScopes.get(element)).toBeUndefined();
    });

    it('should keep scope registered if it has disposables', () => {
      const env = createTestEnv();
      const { ctx, withScope } = env;

      const element = {};

      const { scope } = withScope(element, (scope) => {
        // Add a disposable manually
        scope.firstDisposable = {
          disposable: { dispose: () => {} },
          next: undefined,
        };
      });

      // Scope should remain registered
      expect(ctx.elementScopes.get(element)).toBe(scope);
    });

    it('should keep scope registered if it has renderFn', () => {
      const env = createTestEnv();
      const { ctx, createScope } = env;

      const element = {};

      // Create a scope with renderFn directly
      const scope = createScope(element, undefined, () => {
        // Provide a renderFn
      });

      // Manually register it
      ctx.elementScopes.set(element, scope);

      // Scope should remain registered (has renderFn)
      expect(ctx.elementScopes.get(element)).toBe(scope);
      expect(scope.renderFn).toBeDefined();
    });

    it('should set activeScope during execution', () => {
      const env = createTestEnv();
      const { ctx, withScope } = env;

      const element = {};
      let capturedScope: RenderScope | null = null;

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

      const prevScope = env.createScope({});
      ctx.activeScope = prevScope;

      const element = {};

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

      const parent = {};
      const child = {};

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

      const parentElement = {};
      const parentScope = env.createScope(parentElement);

      const childElement = {};

      // Set as activeScope - withScope should use it as parent
      ctx.activeScope = parentScope;
      const { scope: childScope } = withScope(childElement, () => {});
      ctx.activeScope = null;

      expect(childScope.parent).toBe(parentScope);
    });
  });

  describe('createWithElementScope', () => {
    it('should run code in existing element scope', () => {
      const env = createTestEnv();
      const { ctx, withElementScope } = env;

      const element = {};
      const scope = env.createScope(element);
      ctx.elementScopes.set(element, scope);

      let capturedScope: RenderScope | null = null;
      const result = withElementScope(element, () => {
        capturedScope = ctx.activeScope;
        return 'test';
      });

      expect(capturedScope).toBe(scope);
      expect(result).toBe('test');
    });

    it('should just run code if no scope exists', () => {
      const env = createTestEnv();
      const { ctx, withElementScope } = env;

      const element = {};

      let didRun = false;
      withElementScope(element, () => {
        didRun = true;
        expect(ctx.activeScope).toBeNull();
      });

      expect(didRun).toBe(true);
    });

    it('should restore previous activeScope', () => {
      const env = createTestEnv();
      const { ctx, withElementScope } = env;

      const prevScope = env.createScope({});
      ctx.activeScope = prevScope;

      const element = {};
      const scope = env.createScope(element);
      ctx.elementScopes.set(element, scope);

      withElementScope(element, () => {
        expect(ctx.activeScope).toBe(scope);
      });

      expect(ctx.activeScope).toBe(prevScope);
    });
  });

  describe('integration: withScope + auto-tracking', () => {
    it('should enable automatic disposal tracking pattern', () => {
      const env = createTestEnv();
      const { ctx, signal, disposeScope, withScope } = env;

      // Simulate creating an element with reactive props
      const element = {};
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
            disposable: { dispose },
            next: ctx.activeScope.firstDisposable,
          };
        }
      });

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
