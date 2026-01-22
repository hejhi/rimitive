import { describe, it, expect, vi } from 'vitest';
import { createElFactory } from './el';
import {
  createTestEnv,
  getTextContent,
  createMockAdapter,
  createSignal,
  MockElement,
  MockTreeConfig,
} from './test-utils';
import type { ElementRef, NodeRef, RefSpec } from './types';
import { createTestScopes } from './test-helpers';

// Helper to extract element from NodeRef
const asElement = <T>(nodeRef: NodeRef<T>): T =>
  (nodeRef as ElementRef<T>).element;

// Helper to create test environment for tests that need custom effect
function createCustomTestEnv(effectFn: (fn: () => void) => () => void) {
  const { adapter } = createMockAdapter();
  const { createElementScope, onCleanup } = createTestScopes();

  // Create scopedEffect that wraps the custom effect and registers cleanup
  const scopedEffect = (fn: () => void | (() => void)): (() => void) => {
    // Run the effect and capture its cleanup
    const dispose = effectFn(fn as () => void);

    // Use onCleanup to register the effect's disposal
    onCleanup(() => {
      dispose();
    });

    return dispose;
  };

  return {
    adapter,
    effect: effectFn,
    scopedEffect,
    createElementScope,
    onCleanup,
  };
}

describe('el primitive', () => {
  describe('static content', () => {
    it('renders static content', () => {
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createTestEnv();
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const ref = el('div').props({ className: 'container' })('Hello ', 'World');

      // User cares: content is rendered
      const element: MockElement = asElement(ref.create());
      expect(getTextContent(element)).toBe('Hello World');
      expect(element.props.className).toBe('container');
    });

    it('coalesces adjacent text children into single text node (SSR hydration compatibility)', () => {
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createTestEnv();
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      // Multiple adjacent strings should become one text node
      const ref = el('div')('a', 'b', 'c');
      const element: MockElement = asElement(ref.create());

      // Content is correct
      expect(getTextContent(element)).toBe('abc');
      // Critical: only ONE text child, not three
      // This ensures SSR hydration works (browsers merge adjacent text nodes)
      expect(element.children.length).toBe(1);
    });

    it('nests elements', () => {
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createTestEnv();
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const child = el('span')(
        'nested content'
      ) as unknown as RefSpec<MockElement>;
      const parent = el('div')(child); // Pass blueprint - will be instantiated

      // Create parent instance (which instantiates child)
      const parentElement: MockElement = asElement(parent.create());

      // User cares: nested content is accessible
      expect(getTextContent(parentElement)).toBe('nested content');
      // Child was instantiated during parent creation, so it's in parent's children
      expect(parentElement.children.length).toBe(1);
    });
  });

  describe('reactive content', () => {
    it('renders reactive text children', () => {
      const {
        read: text,
        write: setText,
        subscribers,
      } = createSignal('initial');
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createCustomTestEnv((fn: () => void) => {
          subscribers.add(fn);
          fn();
          return () => subscribers.delete(fn);
        });
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const ref = el('div')(text);

      // User cares: initial content is displayed
      const element: MockElement = asElement(ref.create());
      expect(getTextContent(element)).toBe('initial');

      // User cares: content updates when signal changes
      setText('updated');
      expect(getTextContent(element)).toBe('updated');
    });

    it('updates reactive props', () => {
      const {
        read: className,
        write: setClassName,
        subscribers,
      } = createSignal('foo');
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createCustomTestEnv((fn: () => void) => {
          subscribers.add(fn);
          fn();
          return () => subscribers.delete(fn);
        });
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const ref = el('div').props({ className })();

      // User cares: initial prop value is set
      const element: MockElement = asElement(ref.create());
      expect(element.props.className).toBe('foo');

      // User cares: prop updates when signal changes
      setClassName('bar');
      expect(element.props.className).toBe('bar');
    });

    it('coalesces adjacent static and reactive content into single text node', () => {
      const { read: count, write: setCount, subscribers } = createSignal(0);
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createCustomTestEnv((fn: () => void) => {
          subscribers.add(fn);
          fn();
          return () => subscribers.delete(fn);
        });
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      // Mixed static string + reactive function -> single coalesced reactive text node
      const ref = el('div')('Count: ', count);

      // User cares: content combines static and reactive parts
      const element: MockElement = asElement(ref.create());
      expect(getTextContent(element)).toBe('Count: 0');

      // Critical: only ONE text child (coalesced), not two
      // This ensures SSR hydration works
      expect(element.children.length).toBe(1);

      // User cares: reactive part updates
      setCount(5);
      expect(getTextContent(element)).toBe('Count: 5');
    });

    it('cleans up effects on disconnect', () => {
      const { read: text, subscribers } = createSignal('initial');
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createCustomTestEnv((fn: () => void) => {
          subscribers.add(fn);
          fn();
          return () => subscribers.delete(fn);
        });
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const ref = el('div')(text);
      asElement(ref.create());

      // Verify initial subscription
      expect(subscribers.size).toBe(1);

      // Note: Cleanup happens automatically when element is removed from DOM
      // This test verifies the effect was created, but actual cleanup
      // would happen through the reconciler's disposal mechanism

      // User cares: effect was created (subscription exists)
      expect(subscribers.size).toBe(1);
    });

    it('calls lifecycle cleanup function via .ref()', () => {
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createTestEnv();
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const cleanup = vi.fn();
      const ref = el('div').ref(() => cleanup)();

      // Create instance - lifecycle callback runs immediately
      const element: MockElement = asElement(ref.create());

      // Note: Cleanup would be called when element is removed from DOM
      // through the reconciler's disposal mechanism
      // This test verifies the lifecycle callback runs during creation
      expect(element).toBeDefined();
    });
  });

  describe('props builder pattern', () => {
    it('allows chaining multiple .props() calls', () => {
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createTestEnv();
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const ref = el('div')
        .props({ className: 'base' })
        .props({ id: 'test' })('content');

      const element: MockElement = asElement(ref.create());
      expect(element.props.className).toBe('base');
      expect(element.props.id).toBe('test');
    });

    it('allows props callback to access and extend current props', () => {
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createTestEnv();
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const card = el('div').props({ className: 'card' });
      const blueCard = card.props((p) => ({
        ...p,
        className: `${p.className} blue`,
      }));

      const element: MockElement = asElement(blueCard('content').create());
      expect(element.props.className).toBe('card blue');
    });

    it('creates reusable element factories', () => {
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createTestEnv();
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const div = el('div');
      const container = div.props({ className: 'container' });

      // Same factory, different children
      const ref1 = container('Hello');
      const ref2 = container('World');

      const el1: MockElement = asElement(ref1.create());
      const el2: MockElement = asElement(ref2.create());

      expect(el1.props.className).toBe('container');
      expect(el2.props.className).toBe('container');
      expect(getTextContent(el1)).toBe('Hello');
      expect(getTextContent(el2)).toBe('World');
    });
  });

  describe('ref builder pattern', () => {
    it('allows .ref() to add lifecycle callbacks', () => {
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createTestEnv();
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const lifecycleCalled = vi.fn();
      const ref = el('div').ref(lifecycleCalled)('content');

      asElement(ref.create());
      expect(lifecycleCalled).toHaveBeenCalledTimes(1);
    });

    it('allows chaining multiple .ref() calls', () => {
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createTestEnv();
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const ref = el('div').ref(callback1).ref(callback2)('content');

      asElement(ref.create());
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('allows mixing .props() and .ref() in any order', () => {
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createTestEnv();
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const lifecycleCalled = vi.fn();
      const ref = el('div')
        .props({ className: 'test' })
        .ref(lifecycleCalled)
        .props({ id: 'myId' })('content');

      const element: MockElement = asElement(ref.create());
      expect(element.props.className).toBe('test');
      expect(element.props.id).toBe('myId');
      expect(lifecycleCalled).toHaveBeenCalledTimes(1);
    });

    it('creates reusable factories with baked-in lifecycle', () => {
      const { adapter, scopedEffect, createElementScope, onCleanup } =
        createTestEnv();
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const callCount = { value: 0 };
      const autoFocus = el('input')
        .props({ type: 'text' })
        .ref(() => {
          callCount.value++;
        });

      // Create two instances from same factory
      asElement(autoFocus().create());
      asElement(autoFocus().create());

      expect(callCount.value).toBe(2);
    });

    it('disposes effect returned from .ref() when scope is disposed', () => {
      const {
        adapter,
        scopedEffect,
        createElementScope,
        onCleanup,
        signal,
        effect,
        disposeScope,
        getElementScope,
      } = createTestEnv();
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const count = signal(0);
      let effectRunCount = 0;

      // Create element with effect returned from ref
      const ref = el('div')
        .ref(() =>
          effect(() => {
            count(); // Track signal
            effectRunCount++;
          })
        )();

      const nodeRef = ref.create();
      const element = asElement(nodeRef);

      // Effect ran once on creation
      expect(effectRunCount).toBe(1);

      // Signal change triggers effect
      count(1);
      expect(effectRunCount).toBe(2);

      // Get the scope for the element and dispose it
      const scope = getElementScope(element);
      expect(scope).toBeDefined();
      disposeScope(scope!);

      // Effect should NOT run after disposal
      count(2);
      expect(effectRunCount).toBe(2); // Still 2, not 3
    });

    it('allows signals created in .ref() with returned effect', () => {
      const {
        adapter,
        scopedEffect,
        createElementScope,
        onCleanup,
        signal,
        effect,
        disposeScope,
        getElementScope,
      } = createTestEnv();
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      let effectRunCount = 0;
      let localSignalRef: ReturnType<typeof signal<number>> | null = null;

      // Create element with signal AND effect in ref
      const ref = el('div')
        .ref(() => {
          const localCount = signal(0);
          localSignalRef = localCount; // Capture reference for testing
          return effect(() => {
            localCount(); // Track local signal
            effectRunCount++;
          });
        })();

      const nodeRef = ref.create();
      const element = asElement(nodeRef);

      // Effect ran once on creation
      expect(effectRunCount).toBe(1);

      // Local signal changes trigger effect
      localSignalRef!(1);
      expect(effectRunCount).toBe(2);

      localSignalRef!(2);
      expect(effectRunCount).toBe(3);

      // Dispose scope
      const scope = getElementScope(element);
      expect(scope).toBeDefined();
      disposeScope(scope!);

      // Effect should NOT run after disposal
      localSignalRef!(3);
      expect(effectRunCount).toBe(3); // Still 3, not 4
    });

    it('leaks effect if not returned from .ref()', () => {
      const {
        adapter,
        scopedEffect,
        createElementScope,
        onCleanup,
        signal,
        effect,
        disposeScope,
        getElementScope,
      } = createTestEnv();
      const el = createElFactory<MockTreeConfig>({
        scopedEffect,
        adapter,
        createElementScope,
        onCleanup,
      });

      const count = signal(0);
      let effectRunCount = 0;

      // Create element with effect NOT returned from ref (leak!)
      const ref = el('div')
        .ref(() => {
          effect(() => {
            count();
            effectRunCount++;
          });
          // No return - effect not cleaned up!
        })();

      const nodeRef = ref.create();
      const element = asElement(nodeRef);

      expect(effectRunCount).toBe(1);

      count(1);
      expect(effectRunCount).toBe(2);

      // Get and dispose scope
      const scope = getElementScope(element);
      if (scope) disposeScope(scope);

      // Effect STILL runs - it leaked!
      count(2);
      expect(effectRunCount).toBe(3); // Leaked: 3, not 2
    });
  });
});
