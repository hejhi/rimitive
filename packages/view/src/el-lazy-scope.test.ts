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
  const { trackInScope, runInScope, trackInSpecificScope, createScope } = createTestScopes()
  const { handleChild, processChildren } = createProcessChildren({
    effect,
    renderer,
    trackInScope,
  });

  return {
    ctx,
    renderer,
    effect,
    handleChild,
    processChildren,
    runInScope,
    trackInSpecificScope,
    createScope,
    trackInScope
  };
}

describe('el primitive - lazy scope creation', () => {
  it('does not create scope for fully static elements', () => {
    const {
      ctx,
      renderer,
      effect,
      processChildren,
      runInScope,
      trackInSpecificScope,
      createScope,
      trackInScope
    } = createTestEnv();
    const el = createElFactory({
      ctx,
      effect,
      renderer,
      processChildren,
      runInScope,
      trackInSpecificScope,
      createScope,
      trackInScope
    }).method;

    // Static element - no reactive content, no lifecycle callbacks
    const ref = el(['div', { className: 'static' }, 'Hello']);
    const element = asElement(ref.create());

    // Should not have a scope (memory optimization)
    expect(ctx.elementScopes.has(element)).toBe(false);
  });

  it('creates scope for elements with reactive props', () => {
    const { read: text, subscribers } = createSignal('initial');
    const {
      ctx,
      renderer,
      effect,
      processChildren,
      runInScope,
      trackInSpecificScope,
      createScope,
      trackInScope,
    } = createTestEnv((fn: () => void) => {
      subscribers.add(fn);
      fn();
      return () => subscribers.delete(fn);
    });
    const el = createElFactory({
      ctx,
      effect,
      renderer,
      processChildren,
      runInScope,
      trackInSpecificScope,
      createScope,
      trackInScope,
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
      effect,
      processChildren,
      runInScope,
      trackInSpecificScope,
      createScope,
      trackInScope,
    } = createTestEnv((fn: () => void) => {
      subscribers.add(fn);
      fn();
      return () => subscribers.delete(fn);
    });
    const el = createElFactory({
      ctx,
      effect,
      renderer,
      processChildren,
      runInScope,
      trackInSpecificScope,
      createScope,
      trackInScope,
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
      effect,
      processChildren,
      runInScope,
      trackInSpecificScope,
      createScope,
      trackInScope,
    } = createTestEnv();
    const el = createElFactory({
      ctx,
      effect,
      renderer,
      processChildren,
      runInScope,
      trackInSpecificScope,
      createScope,
      trackInScope,
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

  it('does not create scope when lifecycle callback returns undefined', () => {
    const {
      ctx,
      renderer,
      effect,
      processChildren,
      runInScope,
      trackInSpecificScope,
      createScope,
      trackInScope,
    } = createTestEnv();
    const el = createElFactory({
      ctx,
      effect,
      renderer,
      processChildren,
      runInScope,
      trackInSpecificScope,
      createScope,
      trackInScope,
    }).method;

    // Static element with lifecycle callback that returns nothing
    const ref = el(['div', 'Static content']);
    ref(() => {
      // no cleanup
    });

    const element = asElement(ref.create());

    // Should not have a scope (no cleanup needed)
    expect(ctx.elementScopes.has(element)).toBe(false);
  });

  it('nested static elements should not create scopes', () => {
    const {
      ctx,
      renderer,
      effect,
      processChildren,
      runInScope,
      trackInSpecificScope,
      createScope,
      trackInScope,
    } = createTestEnv();
    const el = createElFactory({
      ctx,
      effect,
      renderer,
      processChildren,
      runInScope,
      trackInSpecificScope,
      createScope,
      trackInScope,
    }).method;

    // Nested static elements
    const child = el(['span', 'Child']);
    const parent = el(['div', child, 'Parent']);

    const parentElement = asElement(parent.create());
    const mockParent = parentElement as unknown as { children: object[] };
    const childElement = mockParent.children[0];

    // Neither should have scopes
    expect(ctx.elementScopes.has(parentElement)).toBe(false);
    if (childElement) {
      expect(ctx.elementScopes.has(childElement)).toBe(false);
    }
  });
});
