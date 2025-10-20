import { describe, it, expect, vi } from 'vitest';
import { createElFactory } from './el';
import { createViewContext } from './context';
import { createMockRenderer, createSignal, getTextContent } from './test-utils';
import { disposeScope } from './helpers/scope';

describe('el primitive', () => {
  describe('static content', () => {
    it('renders static content', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const effect = (fn: () => void) => {
        fn();
        return () => {};
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const ref = el(['div', { className: 'container' }, 'Hello ', 'World']);

      // User cares: content is rendered
      expect(getTextContent(ref.create())).toBe('Hello World');
      expect(ref.create().props.className).toBe('container');
    });

    it('nests elements', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const effect = (fn: () => void) => {
        fn();
        return () => {};
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const child = el(['span', 'nested content']);
      const parent = el(['div', child]); // Pass blueprint - will be instantiated

      // Create parent instance (which instantiates child)
      const parentElement = parent.create();

      // User cares: nested content is accessible
      expect(getTextContent(parentElement)).toBe('nested content');
      // Child was instantiated during parent creation, so it's in parent's children
      expect(parentElement.children.length).toBe(1);
    });
  });

  describe('reactive content', () => {
    it('renders reactive text children', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const { read: text, write: setText, subscribers } = createSignal('initial');
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const ref = el(['div', text]);

      // User cares: initial content is displayed
      expect(getTextContent(ref.create())).toBe('initial');

      // User cares: content updates when signal changes
      setText('updated');
      expect(getTextContent(ref.create())).toBe('updated');
    });

    it('updates reactive props', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const { read: className, write: setClassName, subscribers } = createSignal('foo');
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const ref = el(['div', { className }]);

      // User cares: initial prop value is set
      expect(ref.create().props.className).toBe('foo');

      // User cares: prop updates when signal changes
      setClassName('bar');
      expect(ref.create().props.className).toBe('bar');
    });

    it('handles mixed static and reactive content', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const { read: count, write: setCount, subscribers } = createSignal(0);
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const ref = el(['div', 'Count: ', count]);

      // User cares: mixed content displays correctly
      expect(getTextContent(ref.create())).toBe('Count: 0');

      // User cares: only reactive part updates
      setCount(5);
      expect(getTextContent(ref.create())).toBe('Count: 5');
    });
  });

  describe('lifecycle and cleanup', () => {
    it('cleans up effects on disconnect', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const { read: text, write: setText, subscribers } = createSignal('initial');
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const ref = el(['div', { prop: text }]);

      // Set up lifecycle
      ref(() => {});

      // Create instance once
      const element = ref.create();

      // Verify reactivity works
      expect(element.props.prop).toBe('initial');

      // Reconciler removes element (disposes scope explicitly)
      const scope = ctx.elementScopes.get(element);
      if (scope) {
        disposeScope(scope);
        ctx.elementScopes.delete(element);
      }

      // Update signal after disposal
      setText('updated');

      // User cares: prop doesn't update after cleanup (effect was disposed)
      expect(element.props.prop).toBe('initial');
    });

    it('calls lifecycle cleanup function', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const effect = (fn: () => void) => {
        fn();
        return () => {};
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const cleanup = vi.fn();
      const ref = el(['div']);

      // Register lifecycle callback that returns cleanup
      ref(() => cleanup);

      // Create instance - lifecycle callback runs immediately
      const element = ref.create();

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
