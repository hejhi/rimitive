import { describe, it, expect } from 'vitest';
import { createElFactory } from './el';
import { createLatticeContext } from './context';
import { createMockRenderer, createSignal } from './test-utils';
import { createProcessChildren } from './helpers/processChildren';
import type { ElementRef, NodeRef } from './types';
import { createTestScopes } from './test-helpers';

// Helper to extract element from NodeRef
const asElement = <T>(nodeRef: NodeRef<T>): T => (nodeRef as ElementRef<T>).element;

// Helper to create test environment
function createTestEnv(effectFn?: (fn: () => void) => () => void) {
  const ctx = createLatticeContext();
  const { renderer } = createMockRenderer();
  const effect = effectFn || ((fn: () => void) => {
    fn();
    return () => {};
  });
  const { withScope: baseWithScope } = createTestScopes(ctx)

  // Create scopedEffect using the custom effect
  const scopedEffect = (fn: () => void | (() => void)): () => void => {
    const dispose = effect(fn as () => void);
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

  const { handleChild, processChildren } = createProcessChildren({
    scopedEffect,
    renderer,
  });

  // Create onCleanup helper
  const onCleanup = (cleanup: () => void): void => {
    const scope = ctx.activeScope;
    if (!scope) return;
    scope.firstDisposable = { dispose: cleanup, next: scope.firstDisposable };
  };

  return {
    ctx,
    renderer,
    effect,
    scopedEffect,
    handleChild,
    processChildren,
    withScope: baseWithScope,
    onCleanup
  };
}

describe('el primitive - lazy scope creation', () => {
  it('creates scope for fully static elements (always creates scopes)', () => {
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

    // Static element - no reactive content, no lifecycle callbacks
    // Note: withScope now always creates and registers scopes
    const ref = el(['div', { className: 'static' }, 'Hello']);
    const element = asElement(ref.create());

    // withScope always creates scopes now (no lazy optimization)
    expect(ctx.elementScopes.has(element)).toBe(true);
  });

  it('creates scope for elements with reactive props', () => {
    const { read: text, subscribers } = createSignal('initial');
    const {
      ctx,
      renderer,
      scopedEffect,
      processChildren,
      withScope,
      onCleanup,
    } = createTestEnv((fn: () => void) => {
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

    // Element with reactive prop
    const ref = el(['div', { title: text }]);
    const element = asElement(ref.create());

    // Should have a scope (tracks the effect for reactive title)
    expect(ctx.elementScopes.has(element)).toBe(true);
  });

  it('creates scope for elements with reactive children', () => {
    const { read: text, subscribers } = createSignal('dynamic');
    const {
      ctx,
      renderer,
      scopedEffect,
      processChildren,
      withScope,
      onCleanup,
    } = createTestEnv((fn: () => void) => {
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

    // Element with reactive text child
    const ref = el(['div', text]);
    const element = asElement(ref.create());

    // Should have a scope (tracks the effect for reactive text)
    expect(ctx.elementScopes.has(element)).toBe(true);
  });

  it('creates scope for elements with lifecycle cleanup', () => {
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

    // Static element with lifecycle callback that returns cleanup
    const ref = el(['div', 'Static content']);
    ref(() => () => {
      // cleanup function
    });

    const element = asElement(ref.create());

    // Should have a scope (tracks the cleanup function)
    expect(ctx.elementScopes.has(element)).toBe(true);
  });

  it('creates scope when lifecycle callback returns undefined (always creates scopes)', () => {
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

    // Static element with lifecycle callback that returns nothing
    const ref = el(['div', 'Static content']);
    ref(() => {
      // no cleanup
    });

    const element = asElement(ref.create());

    // withScope always creates scopes now
    expect(ctx.elementScopes.has(element)).toBe(true);
  });

  it('nested static elements create scopes (always creates scopes)', () => {
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

    // Nested static elements
    const child = el(['span', 'Child']);
    const parent = el(['div', child, 'Parent']);

    const parentElement = asElement(parent.create());
    const mockParent = parentElement as unknown as { children: object[] };
    const childElement = mockParent.children[0];

    // withScope always creates scopes now
    expect(ctx.elementScopes.has(parentElement)).toBe(true);
    if (childElement) {
      expect(ctx.elementScopes.has(childElement)).toBe(true);
    }
  });
});
