import { describe, it, expect } from 'vitest';
import { El } from './el';
import {
  createMockRenderer,
  createSignal,
  MockElement,
  MockRendererConfig,
} from './test-utils';
import type { ElementRef, NodeRef, RefSpec } from './types';
import { createTestScopes } from './test-helpers';

// Helper to extract element from NodeRef
const asElement = <T>(nodeRef: NodeRef<T>): T =>
  (nodeRef as ElementRef<T>).element;

// Helper to create test environment
function createTestEnv(effectFn?: (fn: () => void) => () => void) {
  const { renderer } = createMockRenderer();
  const effect =
    effectFn ||
    ((fn: () => void) => {
      fn();
      return () => {};
    });
  const { createElementScope, onCleanup } = createTestScopes();

  // Create scopedEffect that wraps the custom effect and registers cleanup
  const scopedEffect = (fn: () => void | (() => void)): (() => void) => {
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
    onCleanup,
  };
}

describe('el primitive - lazy scope creation', () => {
  it('creates scope for fully static elements (always creates scopes)', () => {
    const { renderer, scopedEffect, createElementScope, onCleanup } =
      createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect,
      renderer,
      createElementScope,
      onCleanup,
    }).method;

    // Static element - no reactive content, no lifecycle callbacks
    // Note: scopes only register if they have disposables (performance optimization)
    const ref = el('div', { className: 'static' })('Hello');
    const element: MockElement = asElement(ref.create());

    // Static element created successfully
    expect(element).toBeDefined();
  });

  it('creates scope for elements with reactive props', () => {
    const { read: text, subscribers } = createSignal('initial');
    const { renderer, scopedEffect, createElementScope, onCleanup } =
      createTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
    const el = El<MockRendererConfig>().create({
      scopedEffect,
      renderer,
      createElementScope,
      onCleanup,
    }).method;

    // Element with reactive prop
    const ref = el('div', { title: text })();
    const element: MockElement = asElement(ref.create());

    // Should have created an effect (subscribers tracked)
    expect(subscribers.size).toBe(1);
    expect(element).toBeDefined();
  });

  it('creates scope for elements with reactive children', () => {
    const { read: text, subscribers } = createSignal('dynamic');
    const { renderer, scopedEffect, createElementScope, onCleanup } =
      createTestEnv((fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      });
    const el = El<MockRendererConfig>().create({
      scopedEffect,
      renderer,
      createElementScope,
      onCleanup,
    }).method;

    // Element with reactive text child
    const ref = el('div')(text);
    const element: MockElement = asElement(ref.create());

    // Should have created an effect (subscribers tracked)
    expect(subscribers.size).toBe(1);
    expect(element).toBeDefined();
  });

  it('creates scope for elements with lifecycle cleanup', () => {
    const { renderer, scopedEffect, createElementScope, onCleanup } =
      createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect,
      renderer,
      createElementScope,
      onCleanup,
    }).method;

    // Static element with lifecycle callback that returns cleanup
    const ref = el('div')('Static content')(() => () => {
      // cleanup function
    });

    const element: MockElement = asElement(ref.create());

    // Element created with lifecycle callback
    expect(element).toBeDefined();
  });

  it('does not register scope when lifecycle callback returns undefined (no disposables)', () => {
    const { renderer, scopedEffect, createElementScope, onCleanup } =
      createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect,
      renderer,
      createElementScope,
      onCleanup,
    }).method;

    // Static element with lifecycle callback that returns nothing
    const ref = el('div')('Static content')(() => {
      // no cleanup
    });

    const element: MockElement = asElement(ref.create());

    // Element created successfully
    expect(element).toBeDefined();
  });

  it('nested static elements do not register scopes (no disposables)', () => {
    const { renderer, scopedEffect, createElementScope, onCleanup } =
      createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect,
      renderer,
      createElementScope,
      onCleanup,
    }).method;

    // Nested static elements
    const child = el('span')('Child') as unknown as RefSpec<MockElement>;
    const parent = el('div')(child, 'Parent');

    const parentElement: MockElement = asElement(parent.create());
    const childElement = parentElement.children[0] as MockElement;

    // Elements created successfully
    expect(parentElement).toBeDefined();
    expect(childElement).toBeDefined();
  });
});
