/**
 * Tests for when() primitive - conditional children rendering
 */

import { describe, it, expect } from 'vitest';
import {
  createTestEnv,
  MockAdapterConfig,
  MockElement,
  getTextContent,
} from './test-utils';
import { When } from './when';
import { El } from './el';
import type { FragmentRef, ElementRef } from './types';
import { STATUS_ELEMENT } from './types';

describe('when() - conditional children rendering', () => {
  function setup() {
    const env = createTestEnv();
    const el = El<MockAdapterConfig>().create({
      scopedEffect: env.scopedEffect,
      adapter: env.adapter,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    const when = When<MockAdapterConfig>().create({
      scopedEffect: env.scopedEffect,
      adapter: env.adapter,
      disposeScope: env.disposeScope,
      getElementScope: env.getElementScope,
    });

    return { ...env, el, when: when.impl };
  }

  /**
   * Helper to create a parent and attach a fragment
   */
  function attachFragment(
    adapter: MockAdapterConfig['baseElement'] extends infer E
      ? { createNode: (tag: string, props?: Record<string, unknown>) => E }
      : never,
    spec: ReturnType<ReturnType<typeof setup>['when']>
  ) {
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
    fragRef.parent = parentRef;
    fragRef.next = null;
    fragRef.attach(parentRef, null);
    return { parent, parentRef, fragRef };
  }

  describe('Basic conditional rendering', () => {
    it('should render children when condition is true', () => {
      const { el, when, signal, adapter } = setup();
      const show = signal(true);

      const spec = when(show, el.impl('p')('conditional content'));

      const { parent } = attachFragment(adapter, spec);

      expect(parent.children.length).toBe(1);
      const child = parent.children[0] as MockElement;
      expect(child.tag).toBe('p');
      expect(getTextContent(child)).toBe('conditional content');
    });

    it('should not render children when condition is false', () => {
      const { el, when, signal, adapter } = setup();
      const show = signal(false);

      const spec = when(show, el.impl('p')('conditional content'));

      const { parent } = attachFragment(adapter, spec);

      expect(parent.children.length).toBe(0);
    });

    it('should add children when condition becomes true', () => {
      const { el, when, signal, adapter } = setup();
      const show = signal(false);

      const spec = when(show, el.impl('p')('conditional'));

      const { parent } = attachFragment(adapter, spec);

      expect(parent.children.length).toBe(0);

      // Toggle to true
      show(true);

      expect(parent.children.length).toBe(1);
      const child = parent.children[0] as MockElement;
      expect(child.tag).toBe('p');
    });

    it('should remove children when condition becomes false', () => {
      const { el, when, signal, adapter } = setup();
      const show = signal(true);

      const spec = when(show, el.impl('p')('conditional'));

      const { parent } = attachFragment(adapter, spec);

      expect(parent.children.length).toBe(1);

      // Toggle to false
      show(false);

      expect(parent.children.length).toBe(0);
    });
  });

  describe('Multiple children', () => {
    it('should handle multiple children', () => {
      const { el, when, signal, adapter } = setup();
      const show = signal(true);

      const spec = when(
        show,
        el.impl('p')('first'),
        el.impl('p')('second'),
        el.impl('p')('third')
      );

      const { parent } = attachFragment(adapter, spec);

      expect(parent.children.length).toBe(3);
      expect((parent.children[0] as MockElement).tag).toBe('p');
      expect((parent.children[1] as MockElement).tag).toBe('p');
      expect((parent.children[2] as MockElement).tag).toBe('p');

      show(false);

      expect(parent.children.length).toBe(0);

      show(true);

      expect(parent.children.length).toBe(3);
    });
  });

  describe('Toggling behavior', () => {
    it('should handle rapid toggling', () => {
      const { el, when, signal, adapter } = setup();
      const show = signal(false);

      const spec = when(show, el.impl('div')('content'));

      const { parent } = attachFragment(adapter, spec);

      expect(parent.children.length).toBe(0);

      // Rapid toggles
      show(true);
      expect(parent.children.length).toBe(1);

      show(false);
      expect(parent.children.length).toBe(0);

      show(true);
      expect(parent.children.length).toBe(1);

      show(false);
      expect(parent.children.length).toBe(0);

      show(true);
      expect(parent.children.length).toBe(1);
    });

    it('should not rebuild when condition stays the same', () => {
      const { el, when, signal, adapter } = setup();
      const show = signal(true);
      let createCount = 0;

      const spec = when(
        show,
        el.impl('div').ref(() => {
          createCount++;
        })('content')
      );

      attachFragment(adapter, spec);

      expect(createCount).toBe(1);

      // Set to same value multiple times
      show(true);
      show(true);
      show(true);

      // Should still only be created once
      expect(createCount).toBe(1);
    });
  });

  describe('Fragment boundaries', () => {
    it('should correctly update fragment boundaries on show', () => {
      const { el, when, signal, adapter } = setup();
      const show = signal(false);

      const spec = when(
        show,
        el.impl('span')('first'),
        el.impl('span')('last')
      );

      const { fragRef } = attachFragment(adapter, spec);

      // Initially no children
      expect(fragRef.firstChild).toBe(null);
      expect(fragRef.lastChild).toBe(null);

      show(true);

      // Should have boundaries set
      expect(fragRef.firstChild).not.toBe(null);
      expect(fragRef.lastChild).not.toBe(null);
      expect(fragRef.firstChild).not.toBe(fragRef.lastChild);
    });

    it('should correctly clear fragment boundaries on hide', () => {
      const { el, when, signal, adapter } = setup();
      const show = signal(true);

      const spec = when(
        show,
        el.impl('span')('first'),
        el.impl('span')('last')
      );

      const { fragRef } = attachFragment(adapter, spec);

      expect(fragRef.firstChild).not.toBe(null);
      expect(fragRef.lastChild).not.toBe(null);

      show(false);

      expect(fragRef.firstChild).toBe(null);
      expect(fragRef.lastChild).toBe(null);
    });
  });

  describe('Lifecycle callbacks', () => {
    it('should call lifecycle callbacks when children are created', () => {
      const { el, when, signal, adapter } = setup();
      const show = signal(false);
      let callbackCalled = false;

      const spec = when(
        show,
        el.impl('div').ref(() => {
          callbackCalled = true;
        })('content')
      );

      attachFragment(adapter, spec);

      expect(callbackCalled).toBe(false);

      show(true);

      expect(callbackCalled).toBe(true);
    });

    it('should dispose children properly when hidden', () => {
      const { el, when, signal, adapter } = setup();
      const show = signal(true);
      let disposed = false;

      const spec = when(
        show,
        el.impl('div').ref(() => {
          return () => {
            disposed = true;
          };
        })('content')
      );

      const { parent } = attachFragment(adapter, spec);

      expect(disposed).toBe(false);
      expect(parent.children.length).toBe(1);

      show(false);

      expect(disposed).toBe(true);
      expect(parent.children.length).toBe(0);
    });
  });
});
