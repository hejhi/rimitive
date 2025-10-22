import { describe, it, expect, vi } from 'vitest';
import { createElFactory } from './el';
import { createTestEnv, getTextContent, createMockRenderer, createSignal } from './test-utils';
import { createViewContext } from './context';
import { createProcessChildren } from './helpers/processChildren';
import type { ElementRef, NodeRef } from './types';
import { createScopes } from './helpers/scope';

// Helper to extract element from NodeRef
const asElement = <T>(nodeRef: NodeRef<T>): T => (nodeRef as ElementRef<T>).element;

// Helper to create test environment for tests that need custom effect
function createCustomTestEnv(effectFn: (fn: () => void) => () => void) {
  const ctx = createViewContext();
  const { renderer } = createMockRenderer();
  const { trackInScope, ...scopeRest } = createScopes({ ctx });
  const { processChildren } = createProcessChildren({
    effect: effectFn,
    renderer,
    trackInScope
  });
  return { ctx, renderer, effect: effectFn, processChildren, trackInScope, ...scopeRest };
}

describe('el primitive', () => {
  describe('static content', () => {
    it('renders static content', () => {
      const {
        ctx,
        renderer,
        effect,
        processChildren,
        createScope,
        runInScope,
        trackInScope,
        trackInSpecificScope,
      } = createTestEnv();
      const el = createElFactory({
        ctx,
        effect,
        renderer,
        processChildren,
        createScope,
        runInScope,
        trackInScope,
        trackInSpecificScope,
      }).method;

      const ref = el(['div', { className: 'container' }, 'Hello ', 'World']);

      // User cares: content is rendered
      expect(getTextContent(asElement(ref.create()))).toBe('Hello World');
      expect(asElement(ref.create()).props.className).toBe('container');
    });

    it('nests elements', () => {
      const {
        ctx,
        renderer,
        effect,
        processChildren,
        createScope,
        runInScope,
        trackInScope,
        trackInSpecificScope,
      } = createTestEnv();
      const el = createElFactory({
        ctx,
        effect,
        renderer,
        processChildren,
        createScope,
        runInScope,
        trackInScope,
        trackInSpecificScope,
      }).method;

      const child = el(['span', 'nested content']);
      const parent = el(['div', child]); // Pass blueprint - will be instantiated

      // Create parent instance (which instantiates child)
      const parentElement = asElement(parent.create());

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
        ctx,
        renderer,
        effect,
        processChildren,
        createScope,
        runInScope,
        trackInScope,
        trackInSpecificScope,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = createElFactory({
        ctx,
        effect,
        renderer,
        processChildren,
        createScope,
        runInScope,
        trackInScope,
        trackInSpecificScope,
      }).method;

      const ref = el(['div', text]);

      // User cares: initial content is displayed
      expect(getTextContent(asElement(ref.create()))).toBe('initial');

      // User cares: content updates when signal changes
      setText('updated');
      expect(getTextContent(asElement(ref.create()))).toBe('updated');
    });

    it('updates reactive props', () => {
      const { read: className, write: setClassName, subscribers } = createSignal('foo');
      const {
        ctx,
        renderer,
        effect,
        processChildren,
        createScope,
        runInScope,
        trackInScope,
        trackInSpecificScope,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = createElFactory({
        ctx,
        effect,
        renderer,
        processChildren,
        createScope,
        runInScope,
        trackInScope,
        trackInSpecificScope,
      }).method;

      const ref = el(['div', { className }]);

      // User cares: initial prop value is set
      expect(asElement(ref.create()).props.className).toBe('foo');

      // User cares: prop updates when signal changes
      setClassName('bar');
      expect(asElement(ref.create()).props.className).toBe('bar');
    });

    it('handles mixed static and reactive content', () => {
      const { read: count, write: setCount, subscribers } = createSignal(0);
      const {
        ctx,
        renderer,
        effect,
        processChildren,
        createScope,
        runInScope,
        trackInScope,
        trackInSpecificScope,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = createElFactory({
        ctx,
        effect,
        renderer,
        processChildren,
        createScope,
        runInScope,
        trackInScope,
        trackInSpecificScope,
      }).method;

      const ref = el(['div', 'Count: ', count]);

      // User cares: mixed content displays correctly
      expect(getTextContent(asElement(ref.create()))).toBe('Count: 0');

      // User cares: only reactive part updates
      setCount(5);
      expect(getTextContent(asElement(ref.create()))).toBe('Count: 5');
    });
  });

  describe('lifecycle and cleanup', () => {
    it('cleans up effects on disconnect', () => {
      const { read: text, write: setText, subscribers } = createSignal('initial');
      const {
        ctx,
        renderer,
        effect,
        processChildren,
        createScope,
        runInScope,
        trackInScope,
        disposeScope,
        trackInSpecificScope,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = createElFactory({
        ctx,
        effect,
        renderer,
        processChildren,
        createScope,
        runInScope,
        trackInScope,
        trackInSpecificScope,
      }).method;

      const ref = el(['div', { title: text }]);

      // Set up lifecycle
      ref(() => {});

      // Create instance once
      const element = asElement(ref.create());

      // Verify reactivity works
      expect(element.props.title).toBe('initial');

      // Reconciler removes element (disposes scope explicitly)
      const scope = ctx.elementScopes.get(element);
      if (scope) {
        disposeScope(scope);
        ctx.elementScopes.delete(element);
      }

      // Update signal after disposal
      setText('updated');

      // User cares: title doesn't update after cleanup (effect was disposed)
      expect(element.props.title).toBe('initial');
    });

    it('calls lifecycle cleanup function', () => {
      const {
        ctx,
        renderer,
        effect,
        processChildren,
        createScope,
        runInScope,
        trackInScope,
        trackInSpecificScope,
        disposeScope
      } = createTestEnv();
      const el = createElFactory({
        ctx,
        effect,
        renderer,
        processChildren,
        createScope,
        runInScope,
        trackInScope,
        trackInSpecificScope,
      }).method;

      const cleanup = vi.fn();
      const ref = el(['div']);

      // Register lifecycle callback that returns cleanup
      ref(() => cleanup);

      // Create instance - lifecycle callback runs immediately
      const element = asElement(ref.create());

      // Reconciler removes element (disposes scope explicitly)
      const scope = ctx.elementScopes.get(element);
      if (scope) {
        disposeScope(scope);
        ctx.elementScopes.delete(element);
      }

      // User cares: cleanup was called
      expect(cleanup).toHaveBeenCalled();
    });
  });
});
