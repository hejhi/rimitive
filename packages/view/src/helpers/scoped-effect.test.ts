import { describe, it, expect } from 'vitest';
import { createTestEnv } from '../test-utils';

describe('scoped-effect', () => {
  describe('createScopedEffect', () => {
    it('should auto-track effects in active scope', () => {
      const env = createTestEnv();
      const { ctx, scopedEffect } = env;

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
      expect(scope.firstDisposable?.dispose).toBe(dispose);
    });

    it('should not track when no active scope', () => {
      const env = createTestEnv();
      const { ctx, scopedEffect } = env;

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
      const { ctx, signal, disposeScope, scopedEffect } = env;

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
      const { ctx, scopedEffect } = env;

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
      expect(scope.firstDisposable?.dispose).toBe(dispose3);
      expect(scope.firstDisposable?.next?.dispose).toBe(dispose2);
      expect(scope.firstDisposable?.next?.next?.dispose).toBe(dispose1);
    });
  });
});
