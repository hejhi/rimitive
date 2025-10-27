import { describe, it, expect, vi } from 'vitest';
import { createElFactory } from './el';
import { createTestEnv, getTextContent, createMockRenderer, createSignal } from './test-utils';
import { createLatticeContext } from './context';
import { createProcessChildren } from './helpers/processChildren';
import type { ElementRef, NodeRef, RenderScope } from './types';
import { createTestScopes } from './test-helpers';

// Helper to extract element from NodeRef
const asElement = <T>(nodeRef: NodeRef<T>): T => (nodeRef as ElementRef<T>).element;

// Helper to create test environment for tests that need custom effect
function createCustomTestEnv(effectFn: (fn: () => void) => () => void) {
  const ctx = createLatticeContext();
  const { renderer } = createMockRenderer();
  const { createScope, disposeScope } = createTestScopes(ctx);

  // Create scopedEffect using the custom effect
  const scopedEffect = (fn: () => void | (() => void)): () => void => {
    const dispose = effectFn(fn as () => void);
    const scope = ctx.activeScope;
    if (scope) {
      const node = {
        disposable: { dispose },
        next: scope.firstDisposable,
      };
      scope.firstDisposable = node;
    }
    return dispose;
  };

  // Create withScope helper
  const withScope = <T>(element: object, fn: (scope: RenderScope) => T): { result: T; scope: RenderScope } => {
    const scope = createScope(element);
    ctx.elementScopes.set(element, scope);
    const prevScope = ctx.activeScope;
    ctx.activeScope = scope;
    let result: T;
    try {
      result = fn(scope);
    } finally {
      ctx.activeScope = prevScope;
    }
    if (scope.firstDisposable === undefined && scope.renderFn === undefined) {
      ctx.elementScopes.delete(element);
    }
    return { result, scope };
  };

  const { processChildren } = createProcessChildren({
    scopedEffect,
    renderer,
  });
  return { ctx, renderer, effect: effectFn, scopedEffect, processChildren, createScope, disposeScope, withScope };
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
      } = createTestEnv();
      const el = createElFactory({
        ctx,
        scopedEffect,
        renderer,
        processChildren,
        withScope,
      }).method;

      const ref = el(['div', { className: 'container' }, 'Hello ', 'World']);

      // User cares: content is rendered
      expect(getTextContent(asElement(ref.create())!)).toBe('Hello World');
      expect(asElement(ref.create())!.props.className).toBe('container');
    });

    it('nests elements', () => {
      const {
        ctx,
        renderer,
        scopedEffect,
        processChildren,
        withScope,
        } = createTestEnv();
      const el = createElFactory({
        ctx,
        scopedEffect,
        renderer,
        processChildren,
        withScope,
      }).method;

      const child = el(['span', 'nested content']);
      const parent = el(['div', child]); // Pass blueprint - will be instantiated

      // Create parent instance (which instantiates child)
      const parentElement = asElement(parent.create())!;

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
      }).method;

      const ref = el(['div', text]);

      // User cares: initial content is displayed
      expect(getTextContent(asElement(ref.create())!)).toBe('initial');

      // User cares: content updates when signal changes
      setText('updated');
      expect(getTextContent(asElement(ref.create())!)).toBe('updated');
    });

    it('updates reactive props', () => {
      const { read: className, write: setClassName, subscribers } = createSignal('foo');
      const {
        ctx,
        renderer,
        scopedEffect,
        processChildren,
        withScope,
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
      }).method;

      const ref = el(['div', { className }]);

      // User cares: initial prop value is set
      expect(asElement(ref.create())!.props.className).toBe('foo');

      // User cares: prop updates when signal changes
      setClassName('bar');
      expect(asElement(ref.create())!.props.className).toBe('bar');
    });

    it('handles mixed static and reactive content', () => {
      const { read: count, write: setCount, subscribers } = createSignal(0);
      const {
        ctx,
        renderer,
        scopedEffect,
        processChildren,
        withScope,
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
      }).method;

      const ref = el(['div', 'Count: ', count]);

      // User cares: content combines static and reactive parts
      expect(getTextContent(asElement(ref.create())!)).toBe('Count: 0');

      // User cares: reactive part updates
      setCount(5);
      expect(getTextContent(asElement(ref.create())!)).toBe('Count: 5');
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
      }).method;

      const ref = el(['div', text]);
      const element = asElement(ref.create())!;

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
        } = createTestEnv();
      const el = createElFactory({
        ctx,
        scopedEffect,
        renderer,
        processChildren,
        withScope,
      }).method;

      const cleanup = vi.fn();
      const ref = el(['div']);

      // Register lifecycle callback that returns cleanup
      ref(() => cleanup);

      // Create instance - lifecycle callback runs immediately
      const element = asElement(ref.create())!;

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
