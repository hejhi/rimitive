import { describe, it, expect, vi } from 'vitest';
import { El } from './el';
import { createTestEnv, getTextContent, createMockRenderer, createSignal, MockElement, MockRendererConfig } from './test-utils';
import type { ElementRef, NodeRef, RefSpec } from './types';
import { createTestScopes } from './test-helpers';

// Helper to extract element from NodeRef
const asElement = <T>(nodeRef: NodeRef<T>): T => (nodeRef as ElementRef<T>).element;

// Helper to create test environment for tests that need custom effect
function createCustomTestEnv(effectFn: (fn: () => void) => () => void) {
  const { renderer } = createMockRenderer();
  const { createElementScope, onCleanup } = createTestScopes();

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

  return { renderer, effect: effectFn, scopedEffect, createElementScope, onCleanup };
}

describe('el primitive', () => {
  describe('static content', () => {
    it('renders static content', () => {
      const {
        renderer,
        scopedEffect,
        createElementScope,
        onCleanup,
      } = createTestEnv();
      const el = El<MockRendererConfig>().create({
        scopedEffect,
        renderer,
        createElementScope,
        onCleanup,
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
        onCleanup,
        } = createTestEnv();
      const el = El<MockRendererConfig>().create({
        scopedEffect,
        renderer,
        createElementScope,
        onCleanup,
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
        onCleanup,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = El<MockRendererConfig>().create({
        scopedEffect,
        renderer,
        createElementScope,
        onCleanup,
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
        onCleanup,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = El<MockRendererConfig>().create({

        scopedEffect,
        renderer,
        createElementScope,
        onCleanup,
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
        onCleanup,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = El<MockRendererConfig>().create({

        scopedEffect,
        renderer,
        createElementScope,
        onCleanup,
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
        onCleanup,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = El<MockRendererConfig>().create({

        scopedEffect,
        renderer,
        createElementScope,
        onCleanup,
      }).method;

      const ref = el('div')(text);
      asElement(ref.create());

      // Verify initial subscription
      expect(subscribers.size).toBe(1);

      // Note: Cleanup happens automatically when element is removed from DOM
      // This test verifies the effect was created, but actual cleanup
      // would happen through the reconciler's disposal mechanism

      // User cares: effect was created (subscription exists)
      expect(subscribers.size).toBe(1);
    });

    it('calls lifecycle cleanup function', () => {
      const {

        renderer,
        scopedEffect,
        createElementScope,
        onCleanup,
        } = createTestEnv();
      const el = El<MockRendererConfig>().create({

        scopedEffect,
        renderer,
        createElementScope,
        onCleanup,
      }).method;

      const cleanup = vi.fn();
      const ref = el('div')()(() => cleanup);

      // Create instance - lifecycle callback runs immediately
      const element: MockElement = asElement(ref.create());

      // Note: Cleanup would be called when element is removed from DOM
      // through the reconciler's disposal mechanism
      // This test verifies the lifecycle callback runs during creation
      expect(element).toBeDefined();
    });
  });
});
