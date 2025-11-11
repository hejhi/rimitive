import { vi } from 'vitest';
import { createBaseContext } from './context';
import type { Renderer, RendererConfig } from './renderer';
import type { Reactive, RefSpec, LifecycleCallback, NodeRef } from './types';
import { STATUS_REF_SPEC } from './types';
import { createScopes } from './helpers/scope';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { Signal } from '@lattice/signals/signal';
import { Effect } from '@lattice/signals/effect';
import { createBaseContext as createSignalContext } from '@lattice/signals/context';
import { createUntracked } from '@lattice/signals/untrack';

// Status constants for RenderScope disposal tracking (matches scope.ts)
const CLEAN = 0;

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

  // DOM-like properties commonly used in tests
  className?: string;
  title?: string;
  value?: string;
  href?: string;
  src?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  checked?: boolean;
  name?: string;

  // Custom test data - used to verify element reuse/preservation in tests
  __customState?: string;

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
 * Mock event for testing event handling
 */
export interface MockEvent {
  type: string;
  target: MockElement | null;
}

/**
 * Mock renderer configuration - maps tag names to MockElement and events to MockEvent
 */
export interface MockRendererConfig extends RendererConfig {
  elements: {
    div: MockElement;
    span: MockElement;
    button: MockElement;
    input: MockElement;
    form: MockElement;
    section: MockElement;
    article: MockElement;
    header: MockElement;
    footer: MockElement;
    nav: MockElement;
    main: MockElement;
    aside: MockElement;
    ul: MockElement;
    ol: MockElement;
    li: MockElement;
    p: MockElement;
    h1: MockElement;
    h2: MockElement;
    h3: MockElement;
    h4: MockElement;
    h5: MockElement;
    h6: MockElement;
    a: MockElement;
    img: MockElement;
    [key: string]: MockElement;
  };
  events: {
    click: MockEvent;
    change: MockEvent;
    input: MockEvent;
    submit: MockEvent;
    [key: string]: MockEvent;
  };
  baseElement: MockElement;
  textNode: MockText;
}

/**
 * Creates a mock renderer for testing
 */
export function createMockRenderer() {
  const renderer: Renderer<MockRendererConfig> = {
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
    addEventListener: vi.fn((element: MockElement, event: string, handler: (event: unknown) => void) => {
      element.listeners.set(event, handler);
      return () => element.listeners.delete(event);
    }),
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
export function createMockDisposable(): { dispose: () => void; disposed: boolean } {
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

  ref.status = STATUS_REF_SPEC;

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
    next: undefined,
  };
}

/**
 * Extracts text content from mock element tree (simulates innerText)
 */
export function getTextContent(element: MockElement | MockText): string {
  if ('content' in element) {
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
  const ctx = createBaseContext<MockElement>();
  const { renderer } = createMockRenderer();

  // Create proper SignalsContext for signals (separate from view context)
  const signalsCtx = createSignalContext();

  // Use real signals integration for proper reactive updates
  const graphEdges = createGraphEdges({ ctx: signalsCtx });
  const { withVisitor } = createGraphTraversal();
  const scheduler = createScheduler({ detachAll: graphEdges.detachAll });
  const propagate = scheduler.withPropagate(withVisitor);

  // Create real signal factory
  const signalFactory = Signal().create({
    ctx: signalsCtx,
    trackDependency: graphEdges.trackDependency,
    propagate,
  });

  // Use real signal
  const signal = signalFactory.method;

  // Use real effect from signals
  const effectFactory = Effect().create({
    ctx: signalsCtx,
    track: graphEdges.track,
    dispose: scheduler.dispose,
  });
  const effect = effectFactory.method;

  // Create untrack helper
  const untrack = createUntracked({ ctx: signalsCtx });

  const { disposeScope, createElementScope, scopedEffect, onCleanup } =
    createScopes<MockElement>({
      ctx,
      baseEffect: effect,
    });

  // Test-only withScope implementation for backward compatibility with tests
  // This provides the idempotent behavior and scope object creation that tests expect
  const withScope = <T = void>(
    element: MockElement,
    fn: (scope: import('./types').RenderScope<MockElement>) => T
  ): {
    result: T;
    scope: import('./types').RenderScope<MockElement> | null;
  } => {
    // Try to get existing scope first (idempotent)
    let scope = ctx.elementScopes.get(element);
    let isNewScope = false;
    let parentScope: import('./types').RenderScope<MockElement> | null = null;

    if (!scope) {
      parentScope = ctx.activeScope;

      // Create scope inline (similar to production createElementScope but always returns scope)
      const RENDER_SCOPE_CLEAN = CLEAN;
      scope = {
        __type: 'render-scope',
        status: RENDER_SCOPE_CLEAN,
        firstChild: undefined,
        nextSibling: undefined,
        firstDisposable: undefined,
        element,
      };

      // Attach to parent's child list
      if (parentScope) {
        scope.nextSibling = parentScope.firstChild;
        parentScope.firstChild = scope;
      }

      isNewScope = true;
    }

    const prevScope = ctx.activeScope;
    ctx.activeScope = scope;

    let result: T;
    try {
      result = fn(scope);
    } catch (e) {
      // Only delete if we registered it
      if (scope.firstDisposable !== undefined) {
        ctx.elementScopes.delete(element);
      }
      disposeScope(scope); // Clean up any disposables that were registered before error
      throw e;
    } finally {
      ctx.activeScope = prevScope;
    }

    // CRITICAL: Only keep scope if it has disposables
    if (isNewScope && scope.firstDisposable !== undefined) {
      ctx.elementScopes.set(element, scope);
      return { result, scope };
    }

    // No disposables - unlink from parent tree and return null
    if (isNewScope && parentScope && parentScope.firstChild === scope) {
      parentScope.firstChild = scope.nextSibling;
    }

    return { result, scope: isNewScope ? null : scope };
  };

  return {
    ctx,
    signalsCtx,
    renderer,
    signal,
    effect,
    untrack,
    disposeScope,
    scopedEffect,
    createElementScope,
    withScope,
    onCleanup,
  };
}
