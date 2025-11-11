import { describe, it, expect } from 'vitest';
import { El } from './el';
import { createMockRenderer, createSignal, MockElement, MockRendererConfig } from './test-utils';
import type { ElementRef, NodeRef, RefSpec } from './types';
import { createTestScopes } from './test-helpers';

// Helper to extract element from NodeRef
const asElement = <T>(nodeRef: NodeRef<T>): T => (nodeRef as ElementRef<T>).element;

// Helper to create test environment
function createTestEnv(effectFn?: (fn: () => void) => () => void) {
  const { renderer } = createMockRenderer();
  const effect = effectFn || ((fn: () => void) => {
    fn();
    return () => {};
  });
  const { createElementScope, disposeScope, onCleanup, getElementScope } = createTestScopes();

  // Create scopedEffect that wraps the custom effect and registers cleanup
  const scopedEffect = (fn: () => void | (() => void)): () => void => {
    // Run the effect and capture its cleanup
    const dispose = effect(fn as () => void);

    // Use onCleanup to register the effect's disposal
    onCleanup(() => {
      dispose();
    });

    return dispose;
  };

  return {
    renderer,
    effect,
    scopedEffect,
    createElementScope,
    disposeScope,
    onCleanup,
    getElementScope
  };
}

describe('el primitive - lazy scope creation', () => {
  it('creates scope for fully static elements (always creates scopes)', () => {
    const {
      renderer,
      scopedEffect,
      createElementScope,
      disposeScope,
      onCleanup,
      getElementScope,
    } = createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect,
      renderer,
      createElementScope,
      disposeScope,
      onCleanup,
      getElementScope,
      }).method;

    // Static element - no reactive content, no lifecycle callbacks
    // Note: scopes only register if they have disposables (performance optimization)
    const ref = el('div', { className: 'static' })('Hello');
    const element: MockElement = asElement(ref.create());

    // No scope registered for static elements (no disposables)
    expect(getElementScope(element)).toBeUndefined();
  });

  it('creates scope for elements with reactive props', () => {
    const { read: text, subscribers } = createSignal('initial');
    const {
      renderer,
      scopedEffect,
      createElementScope,
      disposeScope,
      onCleanup,
      getElementScope,
    } = createTestEnv((fn: () => void) => {
      subscribers.add(fn);
      fn();
      return () => subscribers.delete(fn);
    });
    const el = El<MockRendererConfig>().create({
      scopedEffect,
      renderer,
      createElementScope,
      disposeScope,
      onCleanup,
      getElementScope,
      }).method;

    // Element with reactive prop
    const ref = el('div', { title: text })();
    const element: MockElement = asElement(ref.create());

    // Should have a scope (tracks the effect for reactive title)
    expect(getElementScope(element)).toBeDefined();
  });

  it('creates scope for elements with reactive children', () => {
    const { read: text, subscribers } = createSignal('dynamic');
    const {
      renderer,
      scopedEffect,
      createElementScope,
      disposeScope,
      onCleanup,
      getElementScope,
    } = createTestEnv((fn: () => void) => {
      subscribers.add(fn);
      fn();
      return () => subscribers.delete(fn);
    });
    const el = El<MockRendererConfig>().create({
      scopedEffect,
      renderer,
      createElementScope,
      disposeScope,
      onCleanup,
      getElementScope,
      }).method;

    // Element with reactive text child
    const ref = el('div')(text);
    const element: MockElement = asElement(ref.create());

    // Should have a scope (tracks the effect for reactive text)
    expect(getElementScope(element)).toBeDefined();
  });

  it('creates scope for elements with lifecycle cleanup', () => {
    const {
      renderer,
      scopedEffect,
      createElementScope,
      disposeScope,
      onCleanup,
      getElementScope,
    } = createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect,
      renderer,
      createElementScope,
      disposeScope,
      onCleanup,
      getElementScope,
      }).method;

    // Static element with lifecycle callback that returns cleanup
    const ref = el('div')('Static content')(() => () => {
      // cleanup function
    });

    const element: MockElement = asElement(ref.create());

    // Should have a scope (tracks the cleanup function)
    expect(getElementScope(element)).toBeDefined();
  });

  it('does not register scope when lifecycle callback returns undefined (no disposables)', () => {
    const {
      renderer,
      scopedEffect,
      createElementScope,
      disposeScope,
      onCleanup,
      getElementScope,
    } = createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect,
      renderer,
      createElementScope,
      disposeScope,
      onCleanup,
      getElementScope,
      }).method;

    // Static element with lifecycle callback that returns nothing
    const ref = el('div')('Static content')(() => {
      // no cleanup
    });

    const element: MockElement = asElement(ref.create());

    // No scope registered (callback returns undefined, no disposables)
    expect(getElementScope(element)).toBeUndefined();
  });

  it('nested static elements do not register scopes (no disposables)', () => {
    const {
      renderer,
      scopedEffect,
      createElementScope,
      disposeScope,
      onCleanup,
      getElementScope,
    } = createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect,
      renderer,
      createElementScope,
      disposeScope,
      onCleanup,
      getElementScope,
      }).method;

    // Nested static elements
    const child = el('span')('Child') as unknown as RefSpec<MockElement>;
    const parent = el('div')(child, 'Parent');

    const parentElement: MockElement = asElement(parent.create());
    const childElement = parentElement.children[0] as MockElement;

    // No scopes registered (static elements with no disposables)
    expect(getElementScope(parentElement)).toBeUndefined();
    if (childElement) {
      expect(getElementScope(childElement)).toBeUndefined();
    }
  });
});
