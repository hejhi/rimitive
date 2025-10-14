import { describe, it, expect, vi } from 'vitest';
import { createElFactory } from './el';
import { createViewContext } from './context';
import type { Renderer } from './renderer';

// Test utilities - using classes so they're not treated as plain objects
class MockElement {
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
}

class MockText {
  type = 'text' as const;
  content: string;
  parent: MockElement | null = null;

  constructor(content: string) {
    this.content = content;
  }
}

function createMockElement(tag: string): MockElement {
  return new MockElement(tag);
}

function createMockText(text: string): MockText {
  return new MockText(text);
}

function createMockRenderer() {
  const lifecycleCallbacks = new Map<MockElement, {
    onConnected?: (el: MockElement) => void | (() => void);
    onDisconnected?: (el: MockElement) => void;
  }>();

  const renderer: Renderer<MockElement, MockText> = {
    createElement: vi.fn((tag: string) => createMockElement(tag)),
    createTextNode: vi.fn((text: string) => createMockText(text)),
    updateTextNode: vi.fn((node: MockText, text: string) => {
      node.content = text;
    }),
    setAttribute: vi.fn((element: MockElement, key: string, value: any) => {
      element.props[key] = value;
    }),
    appendChild: vi.fn((parent: MockElement, child: MockElement | MockText) => {
      parent.children.push(child);
      child.parent = parent;
    }),
    removeChild: vi.fn((parent: MockElement, child: MockElement | MockText) => {
      const index = parent.children.indexOf(child);
      if (index !== -1) parent.children.splice(index, 1);
      child.parent = null;
    }),
    insertBefore: vi.fn(),
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

// Simple signal implementation for tests
function createSignal<T>(initialValue: T) {
  let value = initialValue;
  const subscribers = new Set<() => void>();

  const read = () => {
    return value;
  };

  const write = (newValue: T) => {
    value = newValue;
    subscribers.forEach(fn => fn());
  };

  read.peek = () => value;

  return [read, write, subscribers] as const;
}

describe('el primitive', () => {
  describe('element creation', () => {
    it('creates element with specified tag', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const effect = (fn: () => void) => { fn(); return () => {}; };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const ref = el(['div']);

      // correct tag used
      expect(ref.element.tag).toBe('div');
    });

    it('applies static props', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const effect = (fn: () => void) => { fn(); return () => {}; };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const ref = el(['div', { className: 'foo', id: 'bar' }]);

      // props applied
      expect(ref.element.props.className).toBe('foo');
      expect(ref.element.props.id).toBe('bar');
    });

    it('attaches event handlers', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const effect = (fn: () => void) => { fn(); return () => {}; };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const handleClick = vi.fn();
      const ref = el(['button', { onClick: handleClick }]);

      // event handler attached
      expect(ref.element.listeners.get('click')).toBe(handleClick);
    });
  });

  describe('child handling', () => {
    it('renders static text children', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const effect = (fn: () => void) => { fn(); return () => {}; };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const ref = el(['div', 'hello', 42]);

      // text children rendered
      expect(ref.element.children).toHaveLength(2);
      expect(ref.element.children[0]).toMatchObject({ type: 'text', content: 'hello' });
      expect(ref.element.children[1]).toMatchObject({ type: 'text', content: '42' });
    });

    it('ignores null/undefined/false children', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const effect = (fn: () => void) => { fn(); return () => {}; };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const ref = el(['div', null, undefined, false]);

      // falsy children ignored
      expect(ref.element.children).toHaveLength(0);
    });

    it('renders nested elements', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const effect = (fn: () => void) => { fn(); return () => {}; };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const child = el(['span', 'nested']);
      // User passes .element property to nest elements
      const parent = el(['div', child.element]);

      // child element is nested
      expect(parent.element.children).toHaveLength(1);
      expect(parent.element.children[0]).toBe(child.element);
    });

    it('renders reactive text children', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const [signal, setSignal, subscribers] = createSignal('initial');
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const ref = el(['div', signal]);
      const textNode = ref.element.children[0] as MockText;

      // initial value rendered
      expect(textNode.content).toBe('initial');

      // Update signal
      setSignal('updated');

      // text updates reactively
      expect(textNode.content).toBe('updated');
    });
  });

  describe('reactive props', () => {
    it('updates props when signal changes', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const [signal, setSignal, subscribers] = createSignal('foo');
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const ref = el(['div', { className: signal }]);

      // initial value set
      expect(ref.element.props.className).toBe('foo');

      // Update signal
      setSignal('bar');

      // prop updates reactively
      expect(ref.element.props.className).toBe('bar');
    });

    it('handles multiple reactive props', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const [signal1, setSignal1, subscribers1] = createSignal('value1');
      const [signal2, setSignal2, subscribers2] = createSignal('value2');
      const effect = (fn: () => void) => {
        subscribers1.add(fn);
        subscribers2.add(fn);
        fn();
        return () => {
          subscribers1.delete(fn);
          subscribers2.delete(fn);
        };
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const ref = el(['div', { prop1: signal1, prop2: signal2 }]);

      // both initial values set
      expect(ref.element.props.prop1).toBe('value1');
      expect(ref.element.props.prop2).toBe('value2');

      // Update first signal
      setSignal1('updated1');
      expect(ref.element.props.prop1).toBe('updated1');

      // Update second signal
      setSignal2('updated2');
      expect(ref.element.props.prop2).toBe('updated2');
    });
  });

  describe('lifecycle and cleanup', () => {
    it('cleans up on disconnect', () => {
      const ctx = createViewContext();
      const { renderer, connect, disconnect } = createMockRenderer();
      const [signal, setSignal, subscribers] = createSignal('initial');
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const ref = el(['div', { prop: signal }]);

      // Connect and set up lifecycle
      ref(() => {});
      connect(ref.element);

      // Verify reactivity works before disconnect
      expect(ref.element.props.prop).toBe('initial');

      // Disconnect
      disconnect(ref.element);

      // Update signal after disconnect
      setSignal('updated');

      // prop doesn't update after cleanup (effect was disposed)
      expect(ref.element.props.prop).toBe('initial');
    });

    it('calls lifecycle cleanup function', () => {
      const ctx = createViewContext();
      const { renderer, connect, disconnect } = createMockRenderer();
      const effect = (fn: () => void) => { fn(); return () => {}; };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const cleanup = vi.fn();
      const ref = el(['div']);

      // Register lifecycle callback
      ref(() => cleanup);
      connect(ref.element);

      // Disconnect
      disconnect(ref.element);

      // lifecycle cleanup was called
      expect(cleanup).toHaveBeenCalled();
    });
  });

  describe('composition', () => {
    it('handles complex nested structures', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const [signal, setSignal, subscribers] = createSignal('dynamic');
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const child = el(['span', signal]);
      // User passes .element to nest elements
      const parent = el(['div', { className: 'parent' }, 'Static ', child.element, ' text']);

      // structure is correct
      expect(parent.element.tag).toBe('div');
      expect(parent.element.props.className).toBe('parent');
      expect(parent.element.children).toHaveLength(3);

      // Update signal
      setSignal('changed');

      // nested reactivity works
      const childTextNode = (parent.element.children[1] as MockElement).children[0] as MockText;
      expect(childTextNode.content).toBe('changed');
    });

    it('mixes static and reactive content', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const [count, setCount, subscribers] = createSignal(0);
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const el = createElFactory({ ctx, effect, renderer }).method;

      const ref = el(['div', 'Count: ', count]);

      // both rendered
      expect(ref.element.children).toHaveLength(2);
      expect((ref.element.children[0] as MockText).content).toBe('Count: ');
      expect((ref.element.children[1] as MockText).content).toBe('0');

      // Increment
      setCount(1);

      // only reactive part updates
      expect((ref.element.children[0] as MockText).content).toBe('Count: ');
      expect((ref.element.children[1] as MockText).content).toBe('1');
    });
  });
});
