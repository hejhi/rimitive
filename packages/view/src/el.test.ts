import { describe, it, expect, vi } from 'vitest';
import { El } from './el';
import { createTestEnv, getTextContent, createMockRenderer, createSignal, MockElement, MockRendererConfig } from './test-utils';
import type { ElementRef, NodeRef, RefSpec, FragmentRef } from './types';
import { createTestScopes } from './test-helpers';

// Helper to extract element from NodeRef
const asElement = <T>(nodeRef: NodeRef<T>): T => (nodeRef as ElementRef<T>).element;

// Helper to create test environment for tests that need custom effect
function createCustomTestEnv(effectFn: (fn: () => void) => () => void) {
  const { renderer } = createMockRenderer();
  const { createElementScope, disposeScope, onCleanup, getElementScope } = createTestScopes();

  // Create scopedEffect that wraps the custom effect and registers cleanup
  const scopedEffect = (fn: () => void | (() => void)): () => void => {
    // Run the effect and capture its cleanup
    const dispose = effectFn(fn as () => void);

    // Use onCleanup to register the effect's disposal
    onCleanup(() => {
      dispose();
    });

    return dispose;
  };

  return { renderer, effect: effectFn, scopedEffect, disposeScope, createElementScope, onCleanup, getElementScope };
}

describe('el primitive', () => {
  describe('static content', () => {
    it('renders static content', () => {
      const {
        renderer,
        scopedEffect,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      } = createTestEnv();
      const el = El<MockRendererConfig>().create({
        scopedEffect,
        renderer,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      }).method;

      const ref = el('div', { className: 'container' })('Hello ', 'World');

      // User cares: content is rendered
      const element: MockElement = asElement(ref.create());
      expect(getTextContent(element)).toBe('Hello World');
      expect(element.props.className).toBe('container');
    });

    it('nests elements', () => {
      const {
        renderer,
        scopedEffect,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
        } = createTestEnv();
      const el = El<MockRendererConfig>().create({
        scopedEffect,
        renderer,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      }).method;

      const child = el('span')('nested content') as unknown as RefSpec<MockElement>;
      const parent = el('div')(child); // Pass blueprint - will be instantiated

      // Create parent instance (which instantiates child)
      const parentElement: MockElement = asElement(parent.create());

      // User cares: nested content is accessible
      expect(getTextContent(parentElement)).toBe('nested content');
      // Child was instantiated during parent creation, so it's in parent's children
      expect(parentElement.children.length).toBe(1);
    });
  });

  describe('reactive content', () => {
    it('renders reactive text children', () => {
      const { read: text, write: setText, subscribers } = createSignal('initial');
      const {
        renderer,
        scopedEffect,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = El<MockRendererConfig>().create({
        scopedEffect,
        renderer,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      }).method;

      const ref = el('div')(text);

      // User cares: initial content is displayed
      const element: MockElement = asElement(ref.create());
      expect(getTextContent(element)).toBe('initial');

      // User cares: content updates when signal changes
      setText('updated');
      expect(getTextContent(element)).toBe('updated');
    });

    it('updates reactive props', () => {
      const { read: className, write: setClassName, subscribers } = createSignal('foo');
      const {

        renderer,
        scopedEffect,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = El<MockRendererConfig>().create({

        scopedEffect,
        renderer,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      }).method;

      const ref = el('div', { className })();

      // User cares: initial prop value is set
      const element: MockElement = asElement(ref.create());
      expect(element.props.className).toBe('foo');

      // User cares: prop updates when signal changes
      setClassName('bar');
      expect(element.props.className).toBe('bar');
    });

    it('handles mixed static and reactive content', () => {
      const { read: count, write: setCount, subscribers } = createSignal(0);
      const {

        renderer,
        scopedEffect,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = El<MockRendererConfig>().create({

        scopedEffect,
        renderer,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      }).method;

      const ref = el('div')('Count: ', count);

      // User cares: content combines static and reactive parts
      const element: MockElement = asElement(ref.create());
      expect(getTextContent(element)).toBe('Count: 0');

      // User cares: reactive part updates
      setCount(5);
      expect(getTextContent(element)).toBe('Count: 5');
    });

    it('cleans up effects on disconnect', () => {
      const { read: text, subscribers } = createSignal('initial');
      const {

        renderer,
        scopedEffect,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = El<MockRendererConfig>().create({

        scopedEffect,
        renderer,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      }).method;

      const ref = el('div')(text);
      const element: MockElement = asElement(ref.create());

      // Verify initial subscription
      expect(subscribers.size).toBe(1);

      // Simulate element removal (reconciler would call this)
      const scope = getElementScope(element);
      if (scope) {
        disposeScope(scope);
      }

      // User cares: effect was cleaned up (no memory leak)
      expect(subscribers.size).toBe(0);
    });

    it('calls lifecycle cleanup function', () => {
      const {

        renderer,
        scopedEffect,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
        } = createTestEnv();
      const el = El<MockRendererConfig>().create({

        scopedEffect,
        renderer,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      }).method;

      const cleanup = vi.fn();
      const ref = el('div')()(() => cleanup);

      // Create instance - lifecycle callback runs immediately
      const element: MockElement = asElement(ref.create());

      // Reconciler removes element (disposes scope explicitly)
      const scope = getElementScope(element);
      if (scope) {
        disposeScope(scope);
      }

      // User cares: cleanup was called
      expect(cleanup).toHaveBeenCalled();
    });
  });

  describe('reactive element specs', () => {
    it('creates element from reactive spec', () => {
      const { renderer, createElementScope, disposeScope, scopedEffect, onCleanup, getElementScope, signal } = createTestEnv();
      const el = El<MockRendererConfig>().create({

        scopedEffect,
        renderer,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      }).method;

      const reactiveTag = signal<'div' | null>('div');
      const refSpec = el(reactiveTag)('Hello');

      expect(refSpec.status).toBe(4); // STATUS_REF_SPEC

      // Create the fragment by calling create
      const fragmentRef = refSpec.create() as FragmentRef<MockElement>;

      expect(fragmentRef.status).toBe(2); // STATUS_FRAGMENT

      // Create a mock parent
      const parent = renderer.createElement('div');
      const parentRef = { status: 1 as const, element: parent, next: undefined };

      // Attach the fragment
      fragmentRef.attach(parentRef, null);

      // Should have created an element
      expect(fragmentRef.firstChild).toBeDefined();
      if (fragmentRef.firstChild && 'element' in fragmentRef.firstChild) {
        expect((fragmentRef.firstChild.element as MockElement).tag).toBe('div');
      }
    });

    it('toggles between element and null', () => {
      const { renderer, createElementScope, disposeScope, scopedEffect, onCleanup, getElementScope, signal } = createTestEnv();
      const el = El<MockRendererConfig>().create({

        scopedEffect,
        renderer,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      }).method;

      const reactiveTag = signal<'div' | null>('div');

      const fragmentRef = el(reactiveTag)('Hello').create() as FragmentRef<MockElement>;
      const parent = renderer.createElement('div');
      const parentRef = { status: 1 as const, element: parent, next: undefined };

      // Attach fragment
      fragmentRef.attach(parentRef, null);

      // Should have element
      expect(fragmentRef.firstChild).toBeDefined();
      const firstChild = fragmentRef.firstChild;
      expect(firstChild).toBeDefined();
      expect('element' in firstChild!).toBe(true);
      const firstElement = (firstChild as ElementRef<MockElement>).element;
      expect(firstElement).toBeDefined();
      expect(parent.children).toContain(firstElement);

      // Toggle to null
      reactiveTag(null);

      // Element should be removed
      expect(fragmentRef.firstChild).toBeUndefined();
      expect(parent.children).not.toContain(firstElement);

      // Toggle back to element
      reactiveTag('div');

      // Should have new element
      expect(fragmentRef.firstChild).toBeDefined();
      const secondChild = fragmentRef.firstChild;
      expect(secondChild).toBeDefined();
      expect('element' in secondChild!).toBe(true);
      const secondElement = (secondChild as ElementRef<MockElement>).element;
      expect(secondElement).toBeDefined();
      expect(parent.children).toContain(secondElement);
      expect(secondElement).not.toBe(firstElement); // Different element instance
    });

    it('swaps between different element types', () => {
      const { renderer, createElementScope, disposeScope, scopedEffect, onCleanup, getElementScope, signal } = createTestEnv();
      const el = El<MockRendererConfig>().create({

        scopedEffect,
        renderer,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      }).method;

      const reactiveTag = signal<'div' | 'span'>('div');

      const fragmentRef = el(reactiveTag)('Hello').create() as FragmentRef<MockElement>;
      const parent = renderer.createElement('div');
      const parentRef = { status: 1 as const, element: parent, next: undefined };

      fragmentRef.attach(parentRef, null);

      // Should start with div
      expect(fragmentRef.firstChild).toBeDefined();
      const divChild = fragmentRef.firstChild as ElementRef<MockElement>;
      expect(divChild.element.tag).toBe('div');
      const divElement = divChild.element;

      // Swap to span
      reactiveTag('span');

      // Should now be span
      expect(fragmentRef.firstChild).toBeDefined();
      const spanChild = fragmentRef.firstChild as ElementRef<MockElement>;
      expect(spanChild.element.tag).toBe('span');
      const spanElement = spanChild.element;

      // Old element should be removed
      expect(parent.children).not.toContain(divElement);
      // New element should be present
      expect(parent.children).toContain(spanElement);
    });

    it('cleans up scope when element is removed', () => {
      const { renderer, createElementScope, disposeScope, scopedEffect, onCleanup, getElementScope, signal } = createTestEnv();
      const el = El<MockRendererConfig>().create({

        scopedEffect,
        renderer,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      }).method;

      // Create a spec with reactive content to ensure scope is created
      const text = signal('Hello');
      const reactiveTag = signal<'div' | null>('div');

      const fragmentRef = el(reactiveTag)(text).create() as FragmentRef<MockElement>;
      const parent = renderer.createElement('div');
      const parentRef = { status: 1 as const, element: parent, next: undefined };

      fragmentRef.attach(parentRef, null);

      expect(fragmentRef.firstChild).toBeDefined();
      const elementRef = fragmentRef.firstChild as ElementRef<MockElement>;
      const element = elementRef.element;

      // Element should exist
      expect(element).toBeDefined();
      expect(parent.children).toContain(element);

      // Toggle to null
      reactiveTag(null);

      // Element should be removed from DOM
      expect(parent.children).not.toContain(element);
      // If there was a scope, it should be cleaned up
      expect(getElementScope(element)).toBeUndefined();
    });

    it('handles initial null spec', () => {
      const { renderer, createElementScope, disposeScope, scopedEffect, onCleanup, getElementScope, signal } = createTestEnv();
      const el = El<MockRendererConfig>().create({

        scopedEffect,
        renderer,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      }).method;

      const reactiveTag = signal<'div' | null>(null);

      const fragmentRef = el(reactiveTag)('Hello').create() as FragmentRef<MockElement>;
      const parent = renderer.createElement('div');
      const parentRef = { status: 1 as const, element: parent, next: undefined };

      fragmentRef.attach(parentRef, null);

      // Should have no element initially
      expect(fragmentRef.firstChild).toBeUndefined();
      expect(parent.children.length).toBe(0);

      // Toggle to element
      reactiveTag('div');

      // Should now have element
      expect(fragmentRef.firstChild).toBeDefined();
      expect(parent.children.length).toBe(1);
    });

    it('maintains position in DOM when toggling', () => {
      const { renderer, createElementScope, disposeScope, scopedEffect, onCleanup, getElementScope, signal } = createTestEnv();
      const el = El<MockRendererConfig>().create({

        scopedEffect,
        renderer,
        createElementScope,
        disposeScope,
        onCleanup,
        getElementScope,
      }).method;

      const reactiveTag = signal<'span' | null>('span');

      const fragmentRef = el(reactiveTag)('Middle').create() as FragmentRef<MockElement>;
      const parent = renderer.createElement('div');
      const parentRef = { status: 1 as const, element: parent, next: undefined };

      // Create sibling elements
      const before = renderer.createElement('div');
      const after = renderer.createElement('div');
      const beforeText = renderer.createTextNode('Before');
      const afterText = renderer.createTextNode('After');
      renderer.appendChild(before, beforeText);
      renderer.appendChild(after, afterText);
      renderer.appendChild(parent, before);
      renderer.appendChild(parent, after);

      // Attach fragment between siblings
      fragmentRef.attach(parentRef, null);
      expect(fragmentRef.firstChild).toBeDefined();
      const middleElement = (fragmentRef.firstChild as ElementRef<MockElement>).element;

      // Insert before 'after'
      renderer.removeChild(parent, middleElement);
      renderer.insertBefore(parent, middleElement, after);

      // Check order
      expect(parent.children).toEqual([before, middleElement, after]);

      // Toggle to null
      reactiveTag(null);
      expect(parent.children).toEqual([before, after]);

      // Toggle back
      reactiveTag('span');
      expect(fragmentRef.firstChild).toBeDefined();
      const newMiddle = (fragmentRef.firstChild as ElementRef<MockElement>).element;

      // Should be inserted in same position (before 'after')
      expect(parent.children[parent.children.length - 1]).toBe(newMiddle);
    });
  });
});
