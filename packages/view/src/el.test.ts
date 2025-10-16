import { describe, it, expect, vi } from 'vitest';
import { createElFactory } from './el';
import { createViewContext } from './context';
import { createMockRenderer, createSignal, getTextContent } from './test-utils';

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
      expect(getTextContent(ref.element())).toBe('Hello World');
      expect(ref.element().props.className).toBe('container');
    });

    it('handles event listeners via ref', () => {
      const ctx = createViewContext();
      const { renderer, connect } = createMockRenderer();
      const effect = (fn: () => void) => {
        fn();
        return () => {};
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const handleClick = vi.fn();
      const ref = el(['button']);

      // User manually attaches event listeners via ref callback
      ref((el) => {
        const cleanup = renderer.addEventListener(el, 'click', handleClick);
        return cleanup;
      });

      // Simulate element being connected to DOM
      connect(ref.element());

      // Simulate user clicking the button
      const clickHandler = ref.element().listeners.get('click');
      expect(clickHandler).toBeDefined();
      clickHandler?.();

      // User cares: handler was called
      expect(handleClick).toHaveBeenCalledTimes(1);
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
      const parent = el(['div', child]); // Pass ref directly, not .element

      // User cares: nested content is accessible
      expect(getTextContent(parent.element())).toBe('nested content');
      expect(parent.element().children).toContain(child.element());
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
      expect(getTextContent(ref.element())).toBe('initial');

      // User cares: content updates when signal changes
      setText('updated');
      expect(getTextContent(ref.element())).toBe('updated');
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
      expect(ref.element().props.className).toBe('foo');

      // User cares: prop updates when signal changes
      setClassName('bar');
      expect(ref.element().props.className).toBe('bar');
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
      expect(getTextContent(ref.element())).toBe('Count: 0');

      // User cares: only reactive part updates
      setCount(5);
      expect(getTextContent(ref.element())).toBe('Count: 5');
    });
  });

  describe('lifecycle and cleanup', () => {
    it('cleans up effects on disconnect', () => {
      const ctx = createViewContext();
      const { renderer, connect, disconnect } = createMockRenderer();
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
      connect(ref.element());

      // Verify reactivity works before disconnect
      expect(ref.element().props.prop).toBe('initial');

      // User disconnects element (e.g., removes from DOM)
      disconnect(ref.element());

      // Update signal after disconnect
      setText('updated');

      // User cares: prop doesn't update after cleanup (effect was disposed)
      expect(ref.element().props.prop).toBe('initial');
    });

    it('calls lifecycle cleanup function', () => {
      const ctx = createViewContext();
      const { renderer, connect, disconnect } = createMockRenderer();
      const effect = (fn: () => void) => {
        fn();
        return () => {};
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const cleanup = vi.fn();
      const ref = el(['div']);

      // Register lifecycle callback
      ref(() => cleanup);
      connect(ref.element());

      // User disconnects element
      disconnect(ref.element());

      // User cares: cleanup was called
      expect(cleanup).toHaveBeenCalled();
    });
  });
});
