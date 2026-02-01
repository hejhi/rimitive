import { vi } from 'vitest';
import type { Adapter, TreeConfig } from './adapter';
import type { Reactive, RefSpec, NodeRef } from './types';
import { STATUS_REF_SPEC } from './types';
import { createScopes } from './deps/scope';
import { createGraphEdges } from '@rimitive/signals/deps/graph-edges';
import { createScheduler } from '@rimitive/signals/deps/scheduler';
import { createGraphTraversal } from '@rimitive/signals/deps/graph-traversal';
import { createSignalFactory } from '@rimitive/signals/signal';
import { createComputedFactory } from '@rimitive/signals/computed';
import { createEffectFactory } from '@rimitive/signals/effect';
import { createPullPropagator } from '@rimitive/signals/deps/pull-propagator';
import { createIterFactory } from '@rimitive/signals/iter';
import { createUntracked } from '@rimitive/signals/untrack';

// Re-export types for convenience
export type { Reactive };

/**
 * Mock element for testing DOM operations
 */
export class MockElement {
  id: string;
  tag: string;
  props: Record<string, unknown> = {};
  children: Array<MockElement | MockText | MockComment> = [];
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
  onclick?: (event: MouseEvent) => unknown;

  // Custom test data - used to verify element reuse/preservation in tests
  __customState?: string;

  constructor(tag: string) {
    this.id = Math.random().toString(36);
    this.tag = tag;
  }

  // DOM-like properties for reconcile.ts
  get firstChild(): MockElement | MockText | MockComment | null {
    return this.children[0] ?? null;
  }

  get nextSibling(): MockElement | MockText | MockComment | null {
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

  get nextSibling(): MockElement | MockText | MockComment | null {
    if (!this.parent) return null;
    const index = this.parent.children.indexOf(this);
    return this.parent.children[index + 1] ?? null;
  }
}

/**
 * Mock comment node for testing comments
 */
export class MockComment {
  type = 'comment' as const;
  data: string;
  parent: MockElement | null = null;

  constructor(data: string) {
    this.data = data;
  }

  get nextSibling(): MockElement | MockText | MockComment | null {
    if (!this.parent) return null;
    const index = this.parent.children.indexOf(this);
    return this.parent.children[index + 1] ?? null;
  }
}

/**
 * Mock event for testing event handling
 */
export type MockEvent = {
  type: string;
  target: MockElement | null;
};

/**
 * Mock element props - common DOM-like properties for testing
 */
export type MockElementProps = {
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
  onclick?: (event: MouseEvent) => unknown;
  [key: string]: unknown;
};

/**
 * Mock text props - just the value property
 */
export type MockTextProps = {
  value?: string;
};

/**
 * Mock tree configuration - maps tag names to MockElement types
 */
export type MockTreeConfig = TreeConfig & {
  attributes: {
    div: MockElementProps;
    span: MockElementProps;
    button: MockElementProps;
    input: MockElementProps;
    form: MockElementProps;
    section: MockElementProps;
    article: MockElementProps;
    header: MockElementProps;
    footer: MockElementProps;
    nav: MockElementProps;
    main: MockElementProps;
    aside: MockElementProps;
    ul: MockElementProps;
    ol: MockElementProps;
    li: MockElementProps;
    p: MockElementProps;
    h1: MockElementProps;
    h2: MockElementProps;
    h3: MockElementProps;
    h4: MockElementProps;
    h5: MockElementProps;
    h6: MockElementProps;
    a: MockElementProps;
    img: MockElementProps;
    text: MockTextProps;
    [key: string]: MockElementProps | MockTextProps;
  };
  nodes: {
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
    text: MockText;
    [key: string]: MockElement | MockText;
  };
};

/**
 * Creates a mock adapter for testing
 */
export function createMockAdapter() {
  const adapter: Adapter<MockTreeConfig> = {
    createNode: vi.fn((type: string, props?: Record<string, unknown>) => {
      if (type === 'text') {
        return new MockText(
          props?.value != null ? String(props.value) : ''
        ) as MockText;
      }
      return new MockElement(type) as MockElement;
    }),
    setAttribute: vi.fn(
      (node: MockElement | MockText, key: string, value: unknown) => {
        if (node instanceof MockText) {
          if (key === 'value') {
            node.content = value != null ? String(value) : '';
          }
          return;
        }
        node.props[key] = value;
      }
    ),
    appendChild: vi.fn(
      (
        parent: MockElement | MockText,
        child: MockElement | MockText | MockComment
      ) => {
        if (parent instanceof MockText) return; // Text nodes can't have children
        if (!parent.children.includes(child)) {
          parent.children.push(child);
        }
        child.parent = parent;
      }
    ),
    removeChild: vi.fn(
      (
        parent: MockElement | MockText,
        child: MockElement | MockText | MockComment
      ) => {
        if (parent instanceof MockText) return; // Text nodes can't have children
        const index = parent.children.indexOf(child);
        if (index !== -1) parent.children.splice(index, 1);
        child.parent = null;
      }
    ),
    insertBefore: vi.fn(
      (
        parent: MockElement | MockText,
        child: MockElement | MockText | MockComment,
        ref: MockElement | MockText | MockComment | null
      ) => {
        if (parent instanceof MockText) return; // Text nodes can't have children

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
      }
    ),
  };

  return { adapter };
}

/**
 * Creates a simple signal for testing reactive behavior
 */
export function createSignal<T>(initialValue: T) {
  let value = initialValue;
  const subscribers = new Set<() => void>();

  const read = (() => value) as Reactive<T> & { peek: () => T };
  read.peek = () => value;

  const write = (newValue: T) => {
    value = newValue;
    subscribers.forEach((fn) => fn());
  };

  return { read, write, subscribers };
}

/**
 * Creates a mock disposable for testing cleanup
 */
export function createMockDisposable(): {
  dispose: () => void;
  disposed: boolean;
} {
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
  const ref: RefSpec<TElement> = {
    status: STATUS_REF_SPEC,
    // Factory method - for tests, return element wrapped in NodeRef with extensions
    create: <TExt>(
      _svc?: unknown,
      extensions?: TExt
    ): NodeRef<TElement> & TExt => {
      return {
        status: 1 as const, // STATUS_ELEMENT
        element,
        next: undefined,
        ...extensions, // Spread extensions to override/add fields
      } as NodeRef<TElement> & TExt;
    },
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
export function getTextContent(
  element: MockElement | MockText | MockComment
): string {
  if ('content' in element) {
    return element.content;
  }
  if ('data' in element) {
    return ''; // Comments don't contribute to text content
  }
  if ('children' in element) {
    return element.children.map(getTextContent).join('');
  }
  return '';
}

/**
 * Creates a complete test environment with adapter and reactive primitives
 */
export function createTestEnv() {
  const { adapter } = createMockAdapter();

  // Use real signals integration for proper reactive updates
  const graphEdges = createGraphEdges();
  const { withVisitor } = createGraphTraversal();
  const scheduler = createScheduler({
    detachAll: graphEdges.detachAll,
    withVisitor,
  });

  // Create real signal factory
  const signal = createSignalFactory({
    graphEdges,
    propagate: scheduler.propagate,
  });

  // Create pull propagator for computed
  const pullPropagator = createPullPropagator({ track: graphEdges.track });

  // Use real computed from signals
  const computed = createComputedFactory({
    consumer: graphEdges.consumer,
    track: graphEdges.track,
    trackDependency: graphEdges.trackDependency,
    pullUpdates: pullPropagator.pullUpdates,
    shallowPropagate: pullPropagator.shallowPropagate,
  });

  // Use real effect from signals
  const effect = createEffectFactory({
    track: graphEdges.track,
    dispose: scheduler.dispose,
  });

  // Create iter factory
  const iter = createIterFactory({ signal });

  // Create untrack factory
  const untrack = createUntracked({ consumer: graphEdges.consumer });

  const {
    disposeScope,
    createElementScope,
    scopedEffect,
    onCleanup,
    getElementScope,
    withScope,
    createRootScope,
    createChildScope,
  } = createScopes({
    baseEffect: effect,
  });

  return {
    consumer: graphEdges.consumer,
    adapter,
    signal,
    computed,
    effect,
    iter,
    untrack,
    disposeScope,
    scopedEffect,
    createElementScope,
    onCleanup,
    getElementScope,
    withScope,
    createRootScope,
    createChildScope,
  };
}
