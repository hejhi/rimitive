import { describe, it, expect, vi } from 'vitest';
import { createTestEnv, MockElement } from '../test-utils';

describe('scoped-effect', () => {
  describe('createScopedEffect', () => {
    it('should auto-track effects in active scope', () => {
      const env = createTestEnv();
      const { ctx, scopedEffect, createElementScope } = env;

      const element = new MockElement('div');
      let runCount = 0;
      let dispose: (() => void) | undefined;

      // Create a scope - scopedEffect should register within it
      const scope = createElementScope(element, () => {
        dispose = scopedEffect(() => {
          runCount++;
        });
      });

      // Effect should have run once
      expect(runCount).toBe(1);

      // Scope should exist because scopedEffect registered a cleanup
      expect(scope).toBeTruthy();
      expect(ctx.elementScopes.get(element)).toBe(scope);

      // Dispose function should work
      expect(dispose).toBeDefined();
    });

    it('should not track when no active scope', () => {
      const env = createTestEnv();
      const { scopedEffect } = env;

      // Call scopedEffect outside of any scope
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
      const { ctx, signal, disposeScope, scopedEffect, createElementScope } = env;

      const count = signal(0);
      const element = new MockElement('div');

      let runCount = 0;

      // Create scope with reactive effect
      const scope = createElementScope(element, () => {
        scopedEffect(() => {
          count(); // Read signal
          runCount++;
        });
      });

      expect(runCount).toBe(1);

      // Trigger re-run
      count(1);
      expect(runCount).toBe(2);

      // Dispose scope
      disposeScope(scope!);
      ctx.elementScopes.delete(element);

      // Effect should not run anymore
      count(2);
      expect(runCount).toBe(2); // Still 2
    });

    it('should track multiple effects in same scope', () => {
      const env = createTestEnv();
      const { scopedEffect, createElementScope, disposeScope } = env;

      const element = new MockElement('div');
      const cleanups = [vi.fn(), vi.fn(), vi.fn()];

      // Create scope with multiple effects
      const scope = createElementScope(element, () => {
        scopedEffect(() => cleanups[0]);
        scopedEffect(() => cleanups[1]);
        scopedEffect(() => cleanups[2]);
      });

      expect(scope).toBeTruthy();

      // Dispose scope - all cleanups should run
      disposeScope(scope!);

      cleanups.forEach(cleanup => expect(cleanup).toHaveBeenCalledOnce());
    });
  });
});
