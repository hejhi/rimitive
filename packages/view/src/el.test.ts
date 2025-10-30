import { describe, it, expect, vi } from 'vitest';
import { createElFactory } from './el';
import { createTestEnv, getTextContent, createMockRenderer, createSignal, MockElement } from './test-utils';
import { createLatticeContext } from './context';
import { createProcessChildren } from './helpers/processChildren';
import type { ElementRef, NodeRef, RefSpec } from './types';
import { createTestScopes } from './test-helpers';

// Helper to extract element from NodeRef
const asElement = <T>(nodeRef: NodeRef<T>): T => (nodeRef as ElementRef<T>).element;

// Helper to create test environment for tests that need custom effect
function createCustomTestEnv(effectFn: (fn: () => void) => () => void) {
  const ctx = createLatticeContext<MockElement>();
  const { renderer } = createMockRenderer();
  const { withScope: baseWithScope, disposeScope } = createTestScopes<MockElement>(ctx);

  // Create scopedEffect using the custom effect
  const scopedEffect = (fn: () => void | (() => void)): () => void => {
    const dispose = effectFn(fn as () => void);
    const scope = ctx.activeScope;
    if (scope) {
      const node = {
        dispose,
        next: scope.firstDisposable,
      };
      scope.firstDisposable = node;
    }
    return dispose;
  };

  // Create onCleanup helper
  const onCleanup = (cleanup: () => void): void => {
    const scope = ctx.activeScope;
    if (!scope) return;
    scope.firstDisposable = { dispose: cleanup, next: scope.firstDisposable };
  };

  const { processChildren } = createProcessChildren({
    scopedEffect,
    renderer,
  });
  return { ctx, renderer, effect: effectFn, scopedEffect, processChildren, disposeScope, withScope: baseWithScope, onCleanup };
}

describe('el primitive', () => {
  describe('static content', () => {
    it('renders static content', () => {
      const {
        ctx,
        renderer,
        scopedEffect,
        processChildren,
        withScope,
        onCleanup,
      } = createTestEnv();
      const el = createElFactory({
        ctx,
        scopedEffect,
        renderer,
        processChildren,
        withScope,
        onCleanup,
      }).method;

      const ref = el(['div', { className: 'container' }, 'Hello ', 'World']);

      // User cares: content is rendered
      const element = asElement(ref.create()) as unknown as MockElement;
      expect(getTextContent(element)).toBe('Hello World');
      expect(element.props.className).toBe('container');
    });

    it('nests elements', () => {
      const {
        ctx,
        renderer,
        scopedEffect,
        processChildren,
        withScope,
        onCleanup,
        } = createTestEnv();
      const el = createElFactory({
        ctx,
        scopedEffect,
        renderer,
        processChildren,
        withScope,
        onCleanup,
      }).method;

      const child = el(['span', 'nested content']) as unknown as RefSpec<MockElement>;
      const parent = el(['div', child]); // Pass blueprint - will be instantiated

      // Create parent instance (which instantiates child)
      const parentElement = asElement(parent.create()) as unknown as MockElement;

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
        scopedEffect,
        processChildren,
        withScope,
        onCleanup,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = createElFactory({
        ctx,
        scopedEffect,
        renderer,
        processChildren,
        withScope,
        onCleanup,
      }).method;

      const ref = el(['div', text]);

      // User cares: initial content is displayed
      const element = asElement(ref.create()) as unknown as MockElement;
      expect(getTextContent(element)).toBe('initial');

      // User cares: content updates when signal changes
      setText('updated');
      expect(getTextContent(element)).toBe('updated');
    });

    it('updates reactive props', () => {
      const { read: className, write: setClassName, subscribers } = createSignal('foo');
      const {
        ctx,
        renderer,
        scopedEffect,
        processChildren,
        withScope,
        onCleanup,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = createElFactory({
        ctx,
        scopedEffect,
        renderer,
        processChildren,
        withScope,
        onCleanup,
      }).method;

      const ref = el(['div', { className }]);

      // User cares: initial prop value is set
      const element = asElement(ref.create()) as unknown as MockElement;
      expect(element.props.className).toBe('foo');

      // User cares: prop updates when signal changes
      setClassName('bar');
      expect(element.props.className).toBe('bar');
    });

    it('handles mixed static and reactive content', () => {
      const { read: count, write: setCount, subscribers } = createSignal(0);
      const {
        ctx,
        renderer,
        scopedEffect,
        processChildren,
        withScope,
        onCleanup,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = createElFactory({
        ctx,
        scopedEffect,
        renderer,
        processChildren,
        withScope,
        onCleanup,
      }).method;

      const ref = el(['div', 'Count: ', count]);

      // User cares: content combines static and reactive parts
      const element = asElement(ref.create()) as unknown as MockElement;
      expect(getTextContent(element)).toBe('Count: 0');

      // User cares: reactive part updates
      setCount(5);
      expect(getTextContent(element)).toBe('Count: 5');
    });

    it('cleans up effects on disconnect', () => {
      const { read: text, subscribers } = createSignal('initial');
      const {
        ctx,
        renderer,
        scopedEffect,
        processChildren,
        withScope,
        disposeScope,
        onCleanup,
      } = createCustomTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
      const el = createElFactory({
        ctx,
        scopedEffect,
        renderer,
        processChildren,
        withScope,
        onCleanup,
      }).method;

      const ref = el(['div', text]);
      const element = asElement(ref.create()) as unknown as MockElement;

      // Verify initial subscription
      expect(subscribers.size).toBe(1);

      // Simulate element removal (reconciler would call this)
      const scope = ctx.elementScopes.get(element);
      if (scope) {
        disposeScope(scope);
        ctx.elementScopes.delete(element);
      }

      // User cares: effect was cleaned up (no memory leak)
      expect(subscribers.size).toBe(0);
    });

    it('calls lifecycle cleanup function', () => {
      const {
        ctx,
        renderer,
        scopedEffect,
        processChildren,
        withScope,
        disposeScope,
        onCleanup,
        } = createTestEnv();
      const el = createElFactory({
        ctx,
        scopedEffect,
        renderer,
        processChildren,
        withScope,
        onCleanup,
      }).method;

      const cleanup = vi.fn();
      const ref = el(['div']);

      // Register lifecycle callback that returns cleanup
      ref(() => cleanup);

      // Create instance - lifecycle callback runs immediately
      const element = asElement(ref.create()) as unknown as MockElement;

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
