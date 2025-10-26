import { describe, it, expect } from 'vitest';
import { createLatticeContext } from '../context';
import { createScopedEffect, withElementScope } from './scoped-effect';
import { createTestEnv } from '../test-utils';
import type { RenderScope } from '../types';

describe('scoped-effect', () => {
  describe('createScopedEffect', () => {
    it('should auto-track effects in active scope', () => {
      const env = createTestEnv();
      const { ctx, effect } = env;
      const scopedEffect = createScopedEffect({ ctx, baseEffect: effect });

      // Create a scope and set it as active
      const scope = env.createScope({});
      ctx.activeScope = scope;

      let runCount = 0;
      const dispose = scopedEffect(() => {
        runCount++;
      });

      // Effect should have run once
      expect(runCount).toBe(1);

      // Dispose function should be tracked in scope
      expect(scope.firstDisposable).toBeDefined();
      expect(scope.firstDisposable?.disposable).toEqual({ dispose });
    });

    it('should not track when no active scope', () => {
      const env = createTestEnv();
      const { ctx, effect } = env;
      const scopedEffect = createScopedEffect({ ctx, baseEffect: effect });

      ctx.activeScope = null;

      let runCount = 0;
      scopedEffect(() => {
        runCount++;
      });

      // Effect should still run
      expect(runCount).toBe(1);
      // But nothing tracked (no scope to track in)
    });

    it('should dispose when scope is disposed', () => {
      const env = createTestEnv();
      const { ctx, effect, signal, disposeScope } = env;
      const scopedEffect = createScopedEffect({ ctx, baseEffect: effect });

      const count = signal(0);
      const scope = env.createScope({});
      ctx.activeScope = scope;

      let runCount = 0;
      scopedEffect(() => {
        count(); // Read signal
        runCount++;
      });

      expect(runCount).toBe(1);

      // Trigger re-run
      count(1);
      expect(runCount).toBe(2);

      // Dispose scope
      disposeScope(scope);

      // Effect should not run anymore
      count(2);
      expect(runCount).toBe(2); // Still 2
    });

    it('should track multiple effects in same scope', () => {
      const env = createTestEnv();
      const { ctx, effect } = env;
      const scopedEffect = createScopedEffect({ ctx, baseEffect: effect });

      const scope = env.createScope({});
      ctx.activeScope = scope;

      const dispose1 = scopedEffect(() => {});
      const dispose2 = scopedEffect(() => {});
      const dispose3 = scopedEffect(() => {});

      // All three should be tracked
      expect(scope.firstDisposable).toBeDefined();
      expect(scope.firstDisposable?.next).toBeDefined();
      expect(scope.firstDisposable?.next?.next).toBeDefined();

      // First in linked list is last added (LIFO)
      expect(scope.firstDisposable?.disposable).toEqual({ dispose: dispose3 });
      expect(scope.firstDisposable?.next?.disposable).toEqual({ dispose: dispose2 });
      expect(scope.firstDisposable?.next?.next?.disposable).toEqual({ dispose: dispose1 });
    });
  });

  describe('withElementScope', () => {
    it('should run code in element scope if it exists', () => {
      const env = createTestEnv();
      const { ctx } = env;

      const element = {};
      const scope = env.createScope(element);
      ctx.elementScopes.set(element, scope);

      let capturedScope: RenderScope | null = null;
      withElementScope(ctx, element, () => {
        capturedScope = ctx.activeScope;
      });

      expect(capturedScope).toBe(scope);
    });

    it('should just run code if no scope exists', () => {
      const ctx = createLatticeContext();
      const element = {};

      let didRun = false;
      const result = withElementScope(ctx, element, () => {
        didRun = true;
        return 42;
      });

      expect(didRun).toBe(true);
      expect(result).toBe(42);
    });

    it('should restore previous scope after running', () => {
      const env = createTestEnv();
      const { ctx } = env;

      const element1 = {};
      const scope1 = env.createScope(element1);
      ctx.elementScopes.set(element1, scope1);

      const element2 = {};
      const scope2 = env.createScope(element2);
      ctx.elementScopes.set(element2, scope2);

      // Set scope1 as active
      ctx.activeScope = scope1;

      // Run in scope2
      withElementScope(ctx, element2, () => {
        expect(ctx.activeScope).toBe(scope2);
      });

      // Should restore scope1
      expect(ctx.activeScope).toBe(scope1);
    });
  });

  describe('integration: scopedEffect + withElementScope', () => {
    it('should auto-track effect in element scope', () => {
      const env = createTestEnv();
      const { ctx, effect, signal } = env;
      const scopedEffect = createScopedEffect({ ctx, baseEffect: effect });

      const element = {};
      const scope = env.createScope(element);
      ctx.elementScopes.set(element, scope);

      const count = signal(0);
      let runCount = 0;

      withElementScope(ctx, element, () => {
        scopedEffect(() => {
          count(); // Read signal
          runCount++;
        });
      });

      expect(runCount).toBe(1);

      // Effect should be tracked in element's scope
      expect(scope.firstDisposable).toBeDefined();

      // Trigger re-run
      count(1);
      expect(runCount).toBe(2);

      // Dispose element's scope
      env.disposeScope(scope);

      // Effect should not run anymore
      count(2);
      expect(runCount).toBe(2);
    });

    it('should handle nested element scopes', () => {
      const env = createTestEnv();
      const { ctx, effect, signal } = env;
      const scopedEffect = createScopedEffect({ ctx, baseEffect: effect });

      const parentElement = {};
      const parentScope = env.createScope(parentElement);
      ctx.elementScopes.set(parentElement, parentScope);

      const childElement = {};
      const childScope = env.createScope(childElement, parentScope);
      ctx.elementScopes.set(childElement, childScope);

      const count = signal(0);
      let parentRunCount = 0;
      let childRunCount = 0;

      // Create effect in parent scope
      withElementScope(ctx, parentElement, () => {
        scopedEffect(() => {
          count();
          parentRunCount++;
        });
      });

      // Create effect in child scope
      withElementScope(ctx, childElement, () => {
        scopedEffect(() => {
          count();
          childRunCount++;
        });
      });

      expect(parentRunCount).toBe(1);
      expect(childRunCount).toBe(1);

      // Trigger both
      count(1);
      expect(parentRunCount).toBe(2);
      expect(childRunCount).toBe(2);

      // Dispose only child
      env.disposeScope(childScope);

      count(2);
      expect(parentRunCount).toBe(3); // Still running
      expect(childRunCount).toBe(2); // Stopped
    });
  });
});
