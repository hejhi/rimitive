import { vi } from 'vitest';
import { createLatticeContext } from './context';
import type { Renderer } from './renderer';
import type { Reactive, Disposable, RefSpec, LifecycleCallback, NodeRef, RenderScope } from './types';
import { createProcessChildren } from './helpers/processChildren';
import { createScopes } from './helpers/scope';
import { createScopedEffect } from './helpers/scoped-effect';
import { createWithScope, createWithElementScope } from './helpers/with-scope';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createSignalFactory } from '@lattice/signals/signal';
import { createEffectFactory } from '@lattice/signals/effect';

// Re-export types for convenience
export type { Reactive };

/**
 * Mock element for testing DOM operations
 */
export class MockElement {
  id: string;
  tag: string;
  props: Record<string, unknown> = {};
  children: Array<MockElement | MockText> = [];
  parent: MockElement | null = null;
  connected: boolean = false;
  listeners: Map<string, (...args: unknown[]) => void> = new Map();

  constructor(tag: string) {
    this.id = Math.random().toString(36);
    this.tag = tag;
  }

  // DOM-like properties for reconcile.ts
  get firstChild(): MockElement | MockText | null {
    return this.children[0] ?? null;
  }

  get nextSibling(): MockElement | MockText | null {
    if (!this.parent) return null;
    const index = this.parent.children.indexOf(this);
    return this.parent.children[index + 1] ?? null;
  }
}

/**
 * Mock text node for testing text content
 */
export class MockText {
  type = 'text' as const;
  content: string;
  parent: MockElement | null = null;

  constructor(content: string) {
    this.content = content;
  }

  get nextSibling(): MockElement | MockText | null {
    if (!this.parent) return null;
    const index = this.parent.children.indexOf(this);
    return this.parent.children[index + 1] ?? null;
  }
}

/**
 * Creates a mock renderer for testing
 */
export function createMockRenderer() {
  const renderer: Renderer<MockElement, MockText> = {
    createElement: vi.fn((tag: string) => new MockElement(tag)),
    createTextNode: vi.fn((text: string) => new MockText(text)),
    updateTextNode: vi.fn((node: MockText, text: string) => {
      node.content = text;
    }),
    setAttribute: vi.fn((element: MockElement, key: string, value: unknown) => {
      element.props[key] = value;
    }),
    appendChild: vi.fn((parent: MockElement, child: MockElement | MockText) => {
      if (!parent.children.includes(child)) {
        parent.children.push(child);
      }
      child.parent = parent;
    }),
    removeChild: vi.fn((parent: MockElement, child: MockElement | MockText) => {
      const index = parent.children.indexOf(child);
      if (index !== -1) parent.children.splice(index, 1);
      child.parent = null;
    }),
    insertBefore: vi.fn((parent: MockElement, child: MockElement | MockText, ref: MockElement | MockText | null) => {
      // Remove from old position if already in parent
      const oldIndex = parent.children.indexOf(child);
      if (oldIndex !== -1) {
        parent.children.splice(oldIndex, 1);
      }

      // Insert at new position
      if (ref === null || ref === undefined) {
        parent.children.push(child);
      } else {
        const refIndex = parent.children.indexOf(ref);
        if (refIndex !== -1) {
          parent.children.splice(refIndex, 0, child);
        } else {
          parent.children.push(child);
        }
      }
      child.parent = parent;
    }),
    isConnected: vi.fn((element: MockElement) => element.connected),
    isElement: (value: unknown): value is MockElement =>
      value !== null && typeof value === 'object' && 'tag' in value,
  };

  return { renderer };
}

/**
 * Creates a simple signal for testing reactive behavior
 */
export function createSignal<T>(initialValue: T) {
  let value = initialValue;
  const subscribers = new Set<() => void>();

  const read = (() => value) as Reactive<T>;
  read.peek = () => value;

  const write = (newValue: T) => {
    value = newValue;
    subscribers.forEach(fn => fn());
  };

  return { read, write, subscribers };
}

/**
 * Creates a mock disposable for testing cleanup
 */
export function createMockDisposable(): Disposable & { disposed: boolean } {
  const mock = {
    disposed: false,
    dispose: vi.fn(() => {
      mock.disposed = true;
    }),
  };
  return mock;
}

/**
 * Creates an RefSpec from an element for testing
 */
export function createRefSpec<TElement>(element: TElement): RefSpec<TElement> {
  // Store lifecycle callbacks
  const lifecycleCallbacks: LifecycleCallback<TElement>[] = [];

  const ref = ((lifecycleCallback: LifecycleCallback<TElement>): RefSpec<TElement> => {
    lifecycleCallbacks.push(lifecycleCallback);
    return ref;
  }) as RefSpec<TElement>;

  // Factory method - for tests, return element wrapped in NodeRef with extensions
  ref.create = <TExt>(extensions?: TExt): NodeRef<TElement> & TExt => {
    // In tests, we create the element once and reuse it
    // Call lifecycle callbacks if any
    for (const callback of lifecycleCallbacks) {
      callback(element);
    }
    return {
      status: 1 as const, // STATUS_ELEMENT
      element,
      prev: undefined,
      next: undefined,
      ...extensions, // Spread extensions to override/add fields
    } as NodeRef<TElement> & TExt;
  };

  return ref;
}

/**
 * Wraps an element in an ElementRef for testing
 */
export function wrapElement<TElement>(element: TElement) {
  return {
    status: 1 as const, // STATUS_ELEMENT
    element,
    prev: undefined,
    next: undefined,
  };
}

/**
 * Extracts text content from mock element tree (simulates innerText)
 */
export function getTextContent(element: MockElement | MockText): string {
  if ('type' in element && element.type === 'text') {
    return element.content;
  }
  if ('children' in element) {
    return element.children.map(getTextContent).join('');
  }
  return '';
}

/**
 * Creates a complete test environment with context, renderer, and reactive primitives
 */
export function createTestEnv() {
  const ctx = createLatticeContext();
  const { renderer } = createMockRenderer();

  // Create adapter for GlobalContext compatibility
  // signals expects consumerScope but we have activeScope
  const signalsCtx = {
    get consumerScope() { return ctx.activeScope; },
    set consumerScope(value) { ctx.activeScope = value; },
    get trackingVersion() { return ctx.trackingVersion; },
    set trackingVersion(value) { ctx.trackingVersion = value; },
  };

  // Use real signals integration for proper reactive updates
  const graphEdges = createGraphEdges({ ctx: signalsCtx });
  const { withVisitor } = createGraphTraversal();
  const scheduler = createScheduler({ detachAll: graphEdges.detachAll });
  const propagate = scheduler.withPropagate(withVisitor);

  // Create real signal factory
  const signalFactory = createSignalFactory({
    ctx: signalsCtx,
    trackDependency: graphEdges.trackDependency,
    propagate,
  });

  // Use real signal
  const signal = signalFactory.method;

  // Use real effect from signals
  const effectFactory = createEffectFactory({
    ctx: signalsCtx,
    track: graphEdges.track,
    dispose: scheduler.dispose,
  });
  const effect = effectFactory.method;

  const track = graphEdges.track;
  const dispose = scheduler.dispose;

  const { trackInSpecificScope, createScope, disposeScope } = createScopes({ track, dispose })

  // Create new scoped helpers
  const scopedEffect = createScopedEffect({ ctx, baseEffect: effect });
  const withScope = createWithScope({ ctx, createScope });
  const withElementScope = createWithElementScope({ ctx });

  // Helper for tracking in current active scope
  const trackInScope = (disposable: { dispose: () => void }) => {
    const scope = ctx.activeScope;
    if (scope) {
      trackInSpecificScope(scope, disposable);
    }
  };

  // Create helpers
  const { processChildren, handleChild} = createProcessChildren({
    scopedEffect,
    renderer,
  });

  // Create render effect helper (scope with renderFn)
  const createRenderEffect = <TElement = object>(
    element: TElement,
    renderFn: () => void | (() => void),
    parent?: RenderScope<TElement>
  ) => {
    return createScope(element, parent, renderFn);
  };

  return {
    ctx,
    renderer,
    signal,
    effect,
    handleChild,
    processChildren,
    trackInScope,
    trackInSpecificScope,
    createScope,
    disposeScope,
    scopedEffect,
    withScope,
    withElementScope,
    createRenderEffect,
  };
}
