import { vi } from 'vitest';
import { createViewContext } from './context';
import type { Renderer } from './renderer';
import type { Reactive, Disposable, RefSpec, LifecycleCallback } from './types';

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

  // Factory method - for tests, return element wrapped in NodeRef
  ref.create = () => {
    // In tests, we create the element once and reuse it
    // Call lifecycle callbacks if any
    for (const callback of lifecycleCallbacks) {
      callback(element);
    }
    return {
      status: 1, // STATUS_ELEMENT
      element,
      prev: undefined,
      next: undefined,
    };
  };

  return ref;
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
  const ctx = createViewContext();
  const { renderer } = createMockRenderer();

  // Simple signal factory that integrates with effect
  const signalMap = new Map<Reactive<unknown>, Set<() => void>>();

  const signal = <T>(val: T): Reactive<T> => {
    const { read, subscribers } = createSignal(val);
    signalMap.set(read as Reactive<unknown>, subscribers);
    return read;
  };

  // Simple effect that subscribes to signals
  const effect = (fn: () => void) => {
    const cleanup = () => {
      signalMap.forEach(subscribers => subscribers.delete(fn));
    };

    // Subscribe to all signals used during execution
    signalMap.forEach(subscribers => subscribers.add(fn));
    fn();

    return cleanup;
  };

  return {
    ctx,
    renderer,
    signal,
    effect,
  };
}
