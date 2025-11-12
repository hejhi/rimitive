/**
 * Tests for match() primitive
 */

import { describe, it, expect } from 'vitest';
import { createTestEnv, MockRendererConfig } from './test-utils';
import { Match } from './match';
import { El } from './el';

describe('match() - reactive element switching', () => {
  function setup() {
    const env = createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    const match = Match<MockRendererConfig>().create({
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      disposeScope: env.disposeScope,
      onCleanup: env.onCleanup,
      getElementScope: env.getElementScope,
    });

    return { ...env, el, match: match.method };
  }

  describe('Untracked lifecycle callbacks', () => {
    it('should not track outer reactive state in lifecycle callbacks', () => {
      const { el, match, signal, renderer } = setup();

      const showDiv = signal(true);
      const outerState = signal('outer-value');
      let lifecycleCallCount = 0;
      let matcherCallCount = 0;

      // Create match where lifecycle callback reads outerState
      const spec = match(showDiv)((show) => {
        matcherCallCount++;
        return show
          ? el.method('div')('Content')(
              () => {
                lifecycleCallCount++;
                // This read should NOT become a dependency of match's effect
                const value = outerState();
                // Just read it to test tracking - don't need to use it
                void value;
              }
            )
          : null;
      });

      // Create parent and attach
      const parent = renderer.createElement('div');
      const parentRef = { status: 1 as const, element: parent, next: undefined };
      const fragRef = spec.create();
      (fragRef.attach as (parent: typeof parentRef, next: null) => void)(parentRef, null);

      expect(matcherCallCount).toBe(1);  // Initial matcher call
      expect(lifecycleCallCount).toBe(1);  // Initial lifecycle

      // Change outerState - should NOT trigger match's effect or recreate element
      outerState('changed-value');
      expect(matcherCallCount).toBe(1);  // Still 1 - matcher not called again
      expect(lifecycleCallCount).toBe(1);  // Still 1 - lifecycle not re-run

      // Change showDiv - SHOULD trigger match's effect
      showDiv(false);
      expect(matcherCallCount).toBe(2);  // Matcher called for null case
      expect(lifecycleCallCount).toBe(1);  // No new element, so no new lifecycle

      // Change back to true
      showDiv(true);
      expect(matcherCallCount).toBe(3);  // Matcher called again
      expect(lifecycleCallCount).toBe(2);  // New element created, new lifecycle
    });
  });
});
