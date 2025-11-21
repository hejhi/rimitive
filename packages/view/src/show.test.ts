/**
 * Tests for show() primitive - conditional visibility without recreation
 */

import { describe, it, expect } from 'vitest';
import { createTestEnv, MockRendererConfig, MockElement } from './test-utils';
import { Show } from './show';
import { El } from './el';
import type { FragmentRef, ElementRef } from './types';
import { STATUS_ELEMENT } from './types';

describe('show() - conditional visibility without recreation', () => {
  function setup() {
    const env = createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    const show = Show<MockRendererConfig>().create({
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      disposeScope: env.disposeScope,
      onCleanup: env.onCleanup,
      getElementScope: env.getElementScope,
    });

    return { ...env, el, show: show.impl };
  }

  it('should create element only once despite multiple show/hide cycles', () => {
    const { el, show, signal, renderer } = setup();

    const shouldShow = signal(true);
    const spec = show(shouldShow, el.impl('div')('Content'));

    // Create parent and initialize fragment
    const parent = renderer.createElement('section');
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

    // Get reference to the created element
    expect(parent.children.length).toBe(1);
    const element = parent.children[0] as MockElement;
    const elementId = element.id; // Store ID for identity checks

    // Hide the element
    shouldShow(false);
    expect(parent.children.length).toBe(0); // Detached from DOM

    // Show again - should be the SAME element
    shouldShow(true);
    expect(parent.children.length).toBe(1); // Re-attached to DOM
    const reattached1 = parent.children[0] as MockElement;
    expect(reattached1.id).toBe(elementId); // CRITICAL: Same element!

    // Hide and show multiple times
    shouldShow(false);
    expect(parent.children.length).toBe(0);

    shouldShow(true);
    expect(parent.children.length).toBe(1);
    const reattached2 = parent.children[0] as MockElement;
    expect(reattached2.id).toBe(elementId); // Still same element!

    shouldShow(false);
    shouldShow(true);
    const reattached3 = parent.children[0] as MockElement;
    expect(reattached3.id).toBe(elementId); // Still same element!

    // Verify all elements are literally the same instance
    expect(element).toBe(reattached1);
    expect(element).toBe(reattached2);
    expect(element).toBe(reattached3);
  });

  it('should show element when condition is true', () => {
    const { el, show, signal, renderer } = setup();

    const shouldShow = signal(true);
    const spec = show(shouldShow, el.impl('div')('Visible'));

    const parent = renderer.createElement('section');
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

    // Element should be in DOM
    expect(parent.children.length).toBe(1);
    const child = parent.children[0] as MockElement;
    expect(child.tag).toBe('div');
  });

  it('should hide element when condition is false', () => {
    const { el, show, signal, renderer } = setup();

    const shouldShow = signal(false);
    const spec = show(shouldShow, el.impl('div')('Hidden'));

    const parent = renderer.createElement('section');
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

    // Element should NOT be in DOM
    expect(parent.children.length).toBe(0);
  });

  it('should preserve manual DOM modifications across show/hide cycles', () => {
    const { el, show, signal, renderer } = setup();

    const shouldShow = signal(true);
    const spec = show(shouldShow, el.impl('div')('Original'));

    const parent = renderer.createElement('section');
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

    // Get the created element
    const element = parent.children[0] as MockElement;
    const elementId = element.id; // Store original ID for identity check

    // Manually modify the element (simulating user interaction or direct DOM manipulation)
    element.__customState = 'modified-by-user';

    // Hide the element
    shouldShow(false);
    expect(parent.children.length).toBe(0);

    // Show again
    shouldShow(true);
    expect(parent.children.length).toBe(1);

    // CRITICAL: Element should be the same instance with preserved modifications
    const reattachedElement = parent.children[0] as MockElement;
    expect(reattachedElement.id).toBe(elementId); // Same element instance
    expect(reattachedElement.__customState).toBe('modified-by-user'); // State preserved!
  });

  it('should reactively update visibility when condition signal changes', () => {
    const { el, show, signal, renderer } = setup();

    const shouldShow = signal(true);
    const spec = show(shouldShow, el.impl('div')('Reactive'));

    const parent = renderer.createElement('section');
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

    // Initially shown
    expect(parent.children.length).toBe(1);

    // Toggle multiple times
    shouldShow(false);
    expect(parent.children.length).toBe(0);

    shouldShow(true);
    expect(parent.children.length).toBe(1);

    shouldShow(false);
    expect(parent.children.length).toBe(0);

    shouldShow(true);
    expect(parent.children.length).toBe(1);
  });

  it('should call lifecycle callbacks only once on element creation', () => {
    const { el, show, signal, renderer } = setup();

    const shouldShow = signal(true);
    let lifecycleCallCount = 0;
    let cleanupCallCount = 0;

    const spec = show(
      shouldShow,
      el.impl('div')('Content')(() => {
        lifecycleCallCount++;
        return () => {
          cleanupCallCount++;
        };
      })
    );

    const parent = renderer.createElement('section');
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

    expect(lifecycleCallCount).toBe(1);
    expect(cleanupCallCount).toBe(0);

    // Hide and show - lifecycle should NOT be called again
    shouldShow(false);
    expect(lifecycleCallCount).toBe(1); // Still 1
    expect(cleanupCallCount).toBe(0); // Element not disposed, just hidden

    shouldShow(true);
    expect(lifecycleCallCount).toBe(1); // Still 1 - not called again!
    expect(cleanupCallCount).toBe(0); // Still 0

    // Multiple cycles
    shouldShow(false);
    shouldShow(true);
    shouldShow(false);
    shouldShow(true);

    expect(lifecycleCallCount).toBe(1); // Always 1
    expect(cleanupCallCount).toBe(0); // Always 0 during show/hide
  });

  it('should support lifecycle callbacks from show() level', () => {
    const { el, show, signal, renderer } = setup();

    const shouldShow = signal(true);
    let showLevelCallCount = 0;

    const spec = show(
      shouldShow,
      el.impl('div')('Content')
    )(() => {
      showLevelCallCount++;
    });

    const parent = renderer.createElement('section');
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

    expect(showLevelCallCount).toBe(1);

    // Hide and show - should not be called again
    shouldShow(false);
    shouldShow(true);

    expect(showLevelCallCount).toBe(1); // Still 1
  });

  it('should handle fragments as content', () => {
    const { el, show, signal, renderer } = setup();

    const shouldShow = signal(true);

    // Create a fragment with multiple children
    const fragmentSpec = el.impl('div')(
      el.impl('span')('Child 1'),
      el.impl('span')('Child 2')
    );

    const spec = show(shouldShow, fragmentSpec);

    const parent = renderer.createElement('section');
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

    // Div should be in DOM
    expect(parent.children.length).toBe(1);
    const div = parent.children[0] as MockElement;
    expect(div.tag).toBe('div');
    expect(div.children.length).toBe(2);

    // Hide
    shouldShow(false);
    expect(parent.children.length).toBe(0);

    // Show - should reattach the same div with same children
    shouldShow(true);
    expect(parent.children.length).toBe(1);
    const reattachedDiv = parent.children[0] as MockElement;
    expect(reattachedDiv.id).toBe(div.id); // Same instance
    expect(reattachedDiv.children.length).toBe(2);
  });

  it('should maintain element identity for the same RefSpec across show/hide', () => {
    const { el, show, signal, renderer } = setup();

    const shouldShow = signal(true);
    const contentSpec = el.impl('div')('Stable');
    const spec = show(shouldShow, contentSpec);

    const parent = renderer.createElement('section');
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

    const element1 = parent.children[0] as MockElement;
    const id1 = element1.id;

    // Multiple hide/show cycles
    shouldShow(false);
    shouldShow(true);
    const element2 = parent.children[0] as MockElement;
    expect(element2.id).toBe(id1);

    shouldShow(false);
    shouldShow(true);
    const element3 = parent.children[0] as MockElement;
    expect(element3.id).toBe(id1);

    // All elements are the exact same instance
    expect(element1).toBe(element2);
    expect(element2).toBe(element3);
  });

  it('should not throw when starting with false condition and then toggling', () => {
    const { el, show, signal, renderer } = setup();

    // Start with false - this is the bug scenario
    const shouldShow = signal(false);
    const spec = show(shouldShow, el.impl('div')('Content'));

    const parent = renderer.createElement('section');
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

    // This should not throw - element is created but not attached
    expect(() => fragRef.attach(parentRef, null)).not.toThrow();
    expect(parent.children.length).toBe(0);

    // Toggle to true - should attach
    expect(() => shouldShow(true)).not.toThrow();
    expect(parent.children.length).toBe(1);

    // Toggle back to false - should detach
    expect(() => shouldShow(false)).not.toThrow();
    expect(parent.children.length).toBe(0);

    // Toggle to true again - should reattach same element
    expect(() => shouldShow(true)).not.toThrow();
    expect(parent.children.length).toBe(1);
  });
});
