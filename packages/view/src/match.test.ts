/**
 * Tests for match() primitive
 */

import { describe, it, expect } from 'vitest';
import { createTestEnv, MockTreeConfig, MockElement } from './test-utils';
import { createMatchFactory } from './match';
import { createElFactory } from './el';
import type { FragmentRef, ElementRef } from './types';
import { STATUS_ELEMENT } from './types';

describe('match() - reactive element switching', () => {
  function setup() {
    const env = createTestEnv();
    const el = createElFactory<MockTreeConfig>({
      scopedEffect: env.scopedEffect,
      adapter: env.adapter,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    const match = createMatchFactory<MockTreeConfig>({
      scopedEffect: env.scopedEffect,
      adapter: env.adapter,
      disposeScope: env.disposeScope,
      getElementScope: env.getElementScope,
      withScope: env.withScope,
      createChildScope: env.createChildScope,
    });

    return { ...env, el, match };
  }

  describe('Untracked lifecycle callbacks', () => {
    it('should not track outer reactive state in lifecycle callbacks', () => {
      const { el, match, signal, adapter } = setup();

      const showDiv = signal(true);
      const outerState = signal('outer-value');
      let lifecycleCallCount = 0;
      let matcherCallCount = 0;

      // Create match where lifecycle callback reads outerState
      const spec = match(showDiv, (show: boolean) => {
        matcherCallCount++;
        return show
          ? el('div').ref(() => {
              lifecycleCallCount++;
              // This read should NOT become a dependency of match's effect
              const value = outerState();
              // Just read it to test tracking - don't need to use it
              void value;
            })('Content')
          : null;
      });

      // Create parent and initialize fragment
      const parent = adapter.createNode('div') as MockElement;
      const parentRef: ElementRef<MockElement> = {
        status: STATUS_ELEMENT,
        element: parent,
        parent: null,
        prev: null,
        next: null,
        firstChild: null,
        lastChild: null,
      };
      const fragRef = spec.create() as FragmentRef<MockElement>;

      // Set parent and attach fragment
      fragRef.parent = parentRef;
      fragRef.next = null;
      fragRef.attach(parentRef, null);

      expect(matcherCallCount).toBe(1); // Initial matcher call
      expect(lifecycleCallCount).toBe(1); // Initial lifecycle

      // Change outerState - should NOT trigger match's effect or recreate element
      outerState('changed-value');
      expect(matcherCallCount).toBe(1); // Still 1 - matcher not called again
      expect(lifecycleCallCount).toBe(1); // Still 1 - lifecycle not re-run

      // Change showDiv - SHOULD trigger match's effect
      showDiv(false);
      expect(matcherCallCount).toBe(2); // Matcher called for null case
      expect(lifecycleCallCount).toBe(1); // No new element, so no new lifecycle

      // Change back to true
      showDiv(true);
      expect(matcherCallCount).toBe(3); // Matcher called again
      expect(lifecycleCallCount).toBe(2); // New element created, new lifecycle
    });
  });
});
