import { vi } from 'vitest';
import { createViewContext } from './context';
import type { Renderer } from './renderer';
import type { Reactive, Disposable, ElementRef, LifecycleCallback } from './types';

// Re-export types for convenience
export type { Reactive };

/**
 * Mock element for testing DOM operations
 */
export class MockElement {
  id: string;
  tag: string;
  props: Record<string, any> = {};
  children: Array<MockElement | MockText> = [];
  parent: MockElement | null = null;
  connected: boolean = false;
  listeners: Map<string, Function> = new Map();

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
  const lifecycleCallbacks = new Map<MockElement, {
    onConnected?: (el: MockElement) => void | (() => void);
    onDisconnected?: (el: MockElement) => void;
  }>();

  const renderer: Renderer<MockElement, MockText> = {
    createElement: vi.fn((tag: string) => new MockElement(tag)),
    createContainer: vi.fn(() => {
      const container = new MockElement('container');
      container.props.style = { display: 'contents' };
      return container;
    }),
    createTextNode: vi.fn((text: string) => new MockText(text)),
    updateTextNode: vi.fn((node: MockText, text: string) => {
      node.content = text;
    }),
    setAttribute: vi.fn((element: MockElement, key: string, value: any) => {
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
    insertBefore: vi.fn((parent: MockElement, child: MockElement | MockText, ref: unknown | null) => {
      // Remove from old position if already in parent
      const oldIndex = parent.children.indexOf(child);
      if (oldIndex !== -1) {
        parent.children.splice(oldIndex, 1);
      }

      // Insert at new position
      if (ref === null || ref === undefined) {
        parent.children.push(child);
      } else {
        const refIndex = parent.children.indexOf(ref as MockElement | MockText);
        if (refIndex !== -1) {
          parent.children.splice(refIndex, 0, child);
        } else {
          parent.children.push(child);
        }
      }
      child.parent = parent;
    }),
    addEventListener: vi.fn((element: MockElement, event: string, handler: any) => {
      element.listeners.set(event, handler);
      return () => element.listeners.delete(event);
    }),
    observeLifecycle: vi.fn((element: MockElement, callbacks) => {
      lifecycleCallbacks.set(element, callbacks);
      return () => lifecycleCallbacks.delete(element);
    }),
    isConnected: vi.fn((element: MockElement) => element.connected),
    isElement: (value): value is MockElement =>
      value !== null && typeof value === 'object' && 'tag' in value,
    isTextNode: (value): value is MockText =>
      value !== null && typeof value === 'object' && 'type' in value && value.type === 'text',
  };

  // Helper to simulate connection
  const connect = (element: MockElement) => {
    element.connected = true;
    const callbacks = lifecycleCallbacks.get(element);
    if (callbacks?.onConnected) {
      callbacks.onConnected(element);
    }
  };

  const disconnect = (element: MockElement) => {
    element.connected = false;
    const callbacks = lifecycleCallbacks.get(element);
    if (callbacks?.onDisconnected) {
      callbacks.onDisconnected(element);
    }
  };

  return { renderer, connect, disconnect };
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
 * Creates an ElementRef from an element for testing
 */
export function createElementRef<TElement>(element: TElement): ElementRef<TElement> {
  const ref = ((_lifecycleCallback: LifecycleCallback<TElement>): TElement => {
    return element;
  }) as ElementRef<TElement>;
  ref.element = element;
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
  const { renderer, connect, disconnect } = createMockRenderer();

  // Simple signal factory that integrates with effect
  const signalMap = new Map<Reactive<any>, Set<() => void>>();

  const signal = <T>(val: T): Reactive<T> => {
    const { read, write, subscribers } = createSignal(val);
    signalMap.set(read, subscribers);
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
    connect,
    disconnect,
    signal,
    effect,
  };
}
