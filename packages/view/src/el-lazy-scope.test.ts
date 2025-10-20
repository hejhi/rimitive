import { describe, it, expect } from 'vitest';
import { createElFactory } from './el';
import { createViewContext } from './context';
import { createMockRenderer, createSignal } from './test-utils';

describe('el primitive - lazy scope creation', () => {
  it('does not create scope for fully static elements', () => {
    const ctx = createViewContext();
    const { renderer } = createMockRenderer();
    const effect = (fn: () => void) => {
      fn();
      return () => {};
    };
    const el = createElFactory({ ctx, effect, renderer }).method;

    // Static element - no reactive content, no lifecycle callbacks
    const ref = el(['div', { className: 'static' }, 'Hello']);
    const element = ref.create();

    // Should not have a scope (memory optimization)
    expect(ctx.elementScopes.has(element)).toBe(false);
  });

  it('creates scope for elements with reactive props', () => {
    const ctx = createViewContext();
    const { renderer } = createMockRenderer();
    const { read: text, subscribers } = createSignal('initial');
    const effect = (fn: () => void) => {
      subscribers.add(fn);
      fn();
      return () => subscribers.delete(fn);
    };
    const el = createElFactory({ ctx, effect, renderer }).method;

    // Element with reactive prop
    const ref = el(['div', { prop: text }]);
    const element = ref.create();

    // Should have a scope (tracks the effect for reactive prop)
    expect(ctx.elementScopes.has(element)).toBe(true);
  });

  it('creates scope for elements with reactive children', () => {
    const ctx = createViewContext();
    const { renderer } = createMockRenderer();
    const { read: text, subscribers } = createSignal('dynamic');
    const effect = (fn: () => void) => {
      subscribers.add(fn);
      fn();
      return () => subscribers.delete(fn);
    };
    const el = createElFactory({ ctx, effect, renderer }).method;

    // Element with reactive text child
    const ref = el(['div', text]);
    const element = ref.create();

    // Should have a scope (tracks the effect for reactive text)
    expect(ctx.elementScopes.has(element)).toBe(true);
  });

  it('creates scope for elements with lifecycle cleanup', () => {
    const ctx = createViewContext();
    const { renderer } = createMockRenderer();
    const effect = (fn: () => void) => {
      fn();
      return () => {};
    };
    const el = createElFactory({ ctx, effect, renderer }).method;

    // Static element with lifecycle callback that returns cleanup
    const ref = el(['div', 'Static content']);
    ref(() => () => {
      // cleanup function
    });

    const element = ref.create();

    // Should have a scope (tracks the cleanup function)
    expect(ctx.elementScopes.has(element)).toBe(true);
  });

  it('does not create scope when lifecycle callback returns undefined', () => {
    const ctx = createViewContext();
    const { renderer } = createMockRenderer();
    const effect = (fn: () => void) => {
      fn();
      return () => {};
    };
    const el = createElFactory({ ctx, effect, renderer }).method;

    // Static element with lifecycle callback that returns nothing
    const ref = el(['div', 'Static content']);
    ref(() => {
      // no cleanup
    });

    const element = ref.create();

    // Should not have a scope (no cleanup needed)
    expect(ctx.elementScopes.has(element)).toBe(false);
  });

  it('nested static elements should not create scopes', () => {
    const ctx = createViewContext();
    const { renderer } = createMockRenderer();
    const effect = (fn: () => void) => {
      fn();
      return () => {};
    };
    const el = createElFactory({ ctx, effect, renderer }).method;

    // Nested static elements
    const child = el(['span', 'Child']);
    const parent = el(['div', child, 'Parent']);

    const parentElement = parent.create();
    const mockParent = parentElement as unknown as { children: object[] };
    const childElement = mockParent.children[0];

    // Neither should have scopes
    expect(ctx.elementScopes.has(parentElement)).toBe(false);
    if (childElement) {
      expect(ctx.elementScopes.has(childElement)).toBe(false);
    }
  });
});
