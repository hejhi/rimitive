import { describe, it, expect } from 'vitest';
import { El } from './el';
import { createBaseContext } from './context';
import { createMockRenderer, createSignal, MockElement, MockText, MockRendererConfig } from './test-utils';
import type { ElementRef, NodeRef, RefSpec } from './types';
import { createTestScopes } from './test-helpers';

// Helper to extract element from NodeRef
const asElement = <T>(nodeRef: NodeRef<T>): T => (nodeRef as ElementRef<T>).element;

// Helper to create test environment
function createTestEnv(effectFn?: (fn: () => void) => () => void) {
  const ctx = createBaseContext<MockElement>();
  const { renderer } = createMockRenderer();
  const effect = effectFn || ((fn: () => void) => {
    fn();
    return () => {};
  });
  const { createElementScope, disposeScope } = createTestScopes<MockElement>(ctx)

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
    createElementScope,
    disposeScope,
    onCleanup
  };
}

describe('el primitive - lazy scope creation', () => {
  it('creates scope for fully static elements (always creates scopes)', () => {
    const {
      ctx,
      renderer,
      scopedEffect,
      createElementScope,
      disposeScope,
      onCleanup,
    } = createTestEnv();
    const el = El<MockRendererConfig, MockElement, MockText>().create({
      ctx,
      scopedEffect,
      renderer,
      createElementScope,
      disposeScope,
      onCleanup,
      }).method;

    // Static element - no reactive content, no lifecycle callbacks
    // Note: withScope only registers scopes if they have disposables (performance optimization)
    const ref = el('div', { className: 'static' })('Hello');
    const element: MockElement = asElement(ref.create());

    // No scope registered for static elements (no disposables)
    expect(ctx.elementScopes.has(element)).toBe(false);
  });

  it('creates scope for elements with reactive props', () => {
    const { read: text, subscribers } = createSignal('initial');
    const {
      ctx,
      renderer,
      scopedEffect,
      createElementScope,
      disposeScope,
      onCleanup,
    } = createTestEnv((fn: () => void) => {
      subscribers.add(fn);
      fn();
      return () => subscribers.delete(fn);
    });
    const el = El<MockRendererConfig, MockElement, MockText>().create({
      ctx,
      scopedEffect,
      renderer,
      createElementScope,
      disposeScope,
      onCleanup,
      }).method;

    // Element with reactive prop
    const ref = el('div', { title: text })();
    const element: MockElement = asElement(ref.create());

    // Should have a scope (tracks the effect for reactive title)
    expect(ctx.elementScopes.has(element)).toBe(true);
  });

  it('creates scope for elements with reactive children', () => {
    const { read: text, subscribers } = createSignal('dynamic');
    const {
      ctx,
      renderer,
      scopedEffect,
      createElementScope,
      disposeScope,
      onCleanup,
    } = createTestEnv((fn: () => void) => {
      subscribers.add(fn);
      fn();
      return () => subscribers.delete(fn);
    });
    const el = El<MockRendererConfig, MockElement, MockText>().create({
      ctx,
      scopedEffect,
      renderer,
      createElementScope,
      disposeScope,
      onCleanup,
      }).method;

    // Element with reactive text child
    const ref = el('div')(text);
    const element: MockElement = asElement(ref.create());

    // Should have a scope (tracks the effect for reactive text)
    expect(ctx.elementScopes.has(element)).toBe(true);
  });

  it('creates scope for elements with lifecycle cleanup', () => {
    const {
      ctx,
      renderer,
      scopedEffect,
      createElementScope,
      disposeScope,
      onCleanup,
    } = createTestEnv();
    const el = El<MockRendererConfig, MockElement, MockText>().create({
      ctx,
      scopedEffect,
      renderer,
      createElementScope,
      disposeScope,
      onCleanup,
      }).method;

    // Static element with lifecycle callback that returns cleanup
    const ref = el('div')('Static content')(() => () => {
      // cleanup function
    });

    const element: MockElement = asElement(ref.create());

    // Should have a scope (tracks the cleanup function)
    expect(ctx.elementScopes.has(element)).toBe(true);
  });

  it('does not register scope when lifecycle callback returns undefined (no disposables)', () => {
    const {
      ctx,
      renderer,
      scopedEffect,
      createElementScope,
      disposeScope,
      onCleanup,
    } = createTestEnv();
    const el = El<MockRendererConfig, MockElement, MockText>().create({
      ctx,
      scopedEffect,
      renderer,
      createElementScope,
      disposeScope,
      onCleanup,
      }).method;

    // Static element with lifecycle callback that returns nothing
    const ref = el('div')('Static content')(() => {
      // no cleanup
    });

    const element: MockElement = asElement(ref.create());

    // No scope registered (callback returns undefined, no disposables)
    expect(ctx.elementScopes.has(element)).toBe(false);
  });

  it('nested static elements do not register scopes (no disposables)', () => {
    const {
      ctx,
      renderer,
      scopedEffect,
      createElementScope,
      disposeScope,
      onCleanup,
    } = createTestEnv();
    const el = El<MockRendererConfig, MockElement, MockText>().create({
      ctx,
      scopedEffect,
      renderer,
      createElementScope,
      disposeScope,
      onCleanup,
      }).method;

    // Nested static elements
    const child = el('span')('Child') as unknown as RefSpec<MockElement>;
    const parent = el('div')(child, 'Parent');

    const parentElement: MockElement = asElement(parent.create());
    const childElement = parentElement.children[0] as MockElement;

    // No scopes registered (static elements with no disposables)
    expect(ctx.elementScopes.has(parentElement)).toBe(false);
    if (childElement) {
      expect(ctx.elementScopes.has(childElement)).toBe(false);
    }
  });
});
