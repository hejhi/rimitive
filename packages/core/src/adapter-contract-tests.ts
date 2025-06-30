/**
 * @fileoverview Adapter contract test suite
 *
 * This module provides a comprehensive test suite that all Lattice adapters
 * must pass to ensure they correctly implement the StoreAdapter interface.
 *
 * Adapter implementers should use createAdapterTestSuite to validate their
 * implementations against these contract tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StoreAdapter } from './adapter-contract';
import { isStoreAdapter } from './adapter-contract';
import {
  createStoreWithAdapter,
} from './component';
import type { ComponentFactory } from './runtime-types';

/**
 * Test state shape used throughout the adapter tests
 */
interface TestState {
  count: number;
  text: string;
  nested: {
    value: number;
    flag: boolean;
  };
  list: string[];
}

/**
 * Creates the initial test state
 */
function createInitialState(): TestState {
  return {
    count: 0,
    text: 'hello',
    nested: {
      value: 42,
      flag: true,
    },
    list: ['a', 'b', 'c'],
  };
}

/**
 * Type for adapter factory functions that matches our new architecture
 */
export type TestAdapterFactory = <State>(
  initialState?: State
) => StoreAdapter<State>;

/**
 * Creates a comprehensive test suite for StoreAdapter implementations
 *
 * This suite tests all aspects of the adapter contract including:
 * - Basic get/set operations
 * - Partial state updates
 * - Subscription handling
 * - Edge cases and error scenarios
 *
 * @param adapterName - Name of the adapter for test descriptions
 * @param createAdapter - Factory function that creates adapter instances
 *
 * @example
 * ```typescript
 * import { createAdapterTestSuite } from '@lattice/core/testing';
 * import { createMyAdapter } from './my-adapter';
 *
 * createAdapterTestSuite('MyAdapter', createMyAdapter);
 * ```
 */
export function createAdapterTestSuite(
  adapterName: string,
  createAdapter: TestAdapterFactory
) {
  describe(`${adapterName} Adapter Contract`, () => {
    describe('Interface Compliance', () => {
      it('should implement the StoreAdapter interface', () => {
        const adapter = createAdapter<TestState>();

        expect(adapter).toBeDefined();
        expect(typeof adapter.getState).toBe('function');
        expect(typeof adapter.setState).toBe('function');
        expect(typeof adapter.subscribe).toBe('function');
      });

      it('should pass the isStoreAdapter type guard', () => {
        const adapter = createAdapter<TestState>();
        expect(isStoreAdapter(adapter)).toBe(true);
      });

      it('should fail isStoreAdapter for non-adapters', () => {
        expect(isStoreAdapter(null)).toBe(false);
        expect(isStoreAdapter(undefined)).toBe(false);
        expect(isStoreAdapter({})).toBe(false);
        expect(isStoreAdapter({ getState: 'not a function' })).toBe(false);
        expect(
          isStoreAdapter({
            getState: () => {},
            setState: () => {},
            // missing subscribe
          })
        ).toBe(false);
      });
    });

    describe('State Management', () => {
      let adapter: StoreAdapter<TestState>;

      beforeEach(() => {
        adapter = createAdapter<TestState>();
      });

      it('should get the current state', () => {
        adapter.setState(createInitialState());
        const state = adapter.getState();

        expect(state).toEqual(createInitialState());
      });

      it('should handle partial state updates', () => {
        adapter.setState(createInitialState());

        // Update single property
        adapter.setState({ count: 5 });
        expect(adapter.getState().count).toBe(5);
        expect(adapter.getState().text).toBe('hello'); // unchanged

        // Update multiple properties
        adapter.setState({ count: 10, text: 'world' });
        expect(adapter.getState().count).toBe(10);
        expect(adapter.getState().text).toBe('world');
        expect(adapter.getState().nested.value).toBe(42); // unchanged
      });

      it('should handle nested object updates', () => {
        adapter.setState(createInitialState());

        // Update nested property
        adapter.setState({
          nested: { value: 100, flag: false },
        });

        expect(adapter.getState().nested).toEqual({
          value: 100,
          flag: false,
        });
        expect(adapter.getState().count).toBe(0); // unchanged
      });

      it('should handle array updates', () => {
        adapter.setState(createInitialState());

        // Replace array
        adapter.setState({ list: ['x', 'y', 'z'] });
        expect(adapter.getState().list).toEqual(['x', 'y', 'z']);

        // Update with empty array
        adapter.setState({ list: [] });
        expect(adapter.getState().list).toEqual([]);
      });

      it('should not mutate the original state', () => {
        const initial = createInitialState();
        adapter.setState(initial);

        const stateBefore = adapter.getState();
        adapter.setState({ count: 99 });

        // Original objects should not be mutated
        expect(initial.count).toBe(0);
        expect(stateBefore.count).toBe(0);
        expect(adapter.getState().count).toBe(99);
      });

      it('should handle undefined initial state', () => {
        const adapter = createAdapter<{ value?: number }>();

        // Should not throw
        expect(() => adapter.getState()).not.toThrow();

        // Should accept updates
        adapter.setState({ value: 42 });
        expect(adapter.getState().value).toBe(42);
      });

      it('should handle empty object updates', () => {
        adapter.setState(createInitialState());
        const stateBefore = adapter.getState();

        adapter.setState({});
        const stateAfter = adapter.getState();

        // State should be unchanged
        expect(stateAfter).toEqual(stateBefore);
      });
    });

    describe('Subscription Management', () => {
      let adapter: StoreAdapter<TestState>;

      beforeEach(() => {
        adapter = createAdapter<TestState>();
        adapter.setState(createInitialState());
      });

      it('should notify subscribers on state changes', () => {
        const listener = vi.fn();
        adapter.subscribe(listener);

        adapter.setState({ count: 1 });
        expect(listener).toHaveBeenCalledTimes(1);

        adapter.setState({ text: 'world' });
        expect(listener).toHaveBeenCalledTimes(2);
      });

      it('should support multiple subscribers', () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();
        const listener3 = vi.fn();

        adapter.subscribe(listener1);
        adapter.subscribe(listener2);
        adapter.subscribe(listener3);

        adapter.setState({ count: 1 });

        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener2).toHaveBeenCalledTimes(1);
        expect(listener3).toHaveBeenCalledTimes(1);
      });

      it('should return unsubscribe function', () => {
        const listener = vi.fn();
        const unsubscribe = adapter.subscribe(listener);

        expect(typeof unsubscribe).toBe('function');

        adapter.setState({ count: 1 });
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();

        adapter.setState({ count: 2 });
        expect(listener).toHaveBeenCalledTimes(1); // Not called again
      });

      it('should handle unsubscribe during notification', () => {
        const listeners: Array<() => void> = [];
        const unsubscribes: Array<() => void> = [];

        // First listener unsubscribes the second
        listeners[0] = vi.fn(() => {
          unsubscribes[1]?.();
        });

        listeners[1] = vi.fn();
        listeners[2] = vi.fn();

        unsubscribes[0] = adapter.subscribe(listeners[0]);
        unsubscribes[1] = adapter.subscribe(listeners[1]);
        unsubscribes[2] = adapter.subscribe(listeners[2]);

        adapter.setState({ count: 1 });

        expect(listeners[0]).toHaveBeenCalledTimes(1);
        expect(listeners[1]).toHaveBeenCalledTimes(1); // Still called in current cycle
        expect(listeners[2]).toHaveBeenCalledTimes(1);

        // Second update
        adapter.setState({ count: 2 });

        expect(listeners[0]).toHaveBeenCalledTimes(2);
        expect(listeners[1]).toHaveBeenCalledTimes(1); // Not called anymore
        expect(listeners[2]).toHaveBeenCalledTimes(2);
      });

      it('should handle multiple unsubscribes of the same listener', () => {
        const listener = vi.fn();
        const unsubscribe = adapter.subscribe(listener);

        // Unsubscribe multiple times should not throw
        expect(() => {
          unsubscribe();
          unsubscribe();
          unsubscribe();
        }).not.toThrow();

        adapter.setState({ count: 1 });
        expect(listener).not.toHaveBeenCalled();
      });

      it('should not notify for empty updates', () => {
        const listener = vi.fn();
        adapter.subscribe(listener);

        adapter.setState({});

        // Implementation-dependent: some adapters may or may not notify
        // This test documents the behavior but doesn't enforce it
        // Adapters should be consistent in their behavior
      });
    });

    describe('Component Integration', () => {
      it('should work with createStoreWithAdapter', () => {
        const adapter = createAdapter(createInitialState());

        const Counter: ComponentFactory<TestState> = ({ store, set }) => ({
          count: store.count,
          increment: () => set(store.count, store.count() + 1),
          decrement: () => set(store.count, store.count() - 1),
        });

        const TextEditor: ComponentFactory<TestState> = ({ store, set }) => ({
          text: store.text,
          setText: (text: string) => set(store.text, text),
          append: (suffix: string) => set(store.text, store.text() + suffix),
        });

        const counter = createStoreWithAdapter(adapter)(Counter);
        const textEditor = createStoreWithAdapter(adapter)(TextEditor);

        // Test initial state
        expect(counter.count()).toBe(0);
        expect(textEditor.text()).toBe('hello');

        // Test mutations
        counter.increment();
        expect(counter.count()).toBe(1);

        textEditor.setText('goodbye');
        expect(textEditor.text()).toBe('goodbye');

        textEditor.append(' world');
        expect(textEditor.text()).toBe('goodbye world');

        // Test subscriptions
        const listener = vi.fn();
        const unsubscribe = counter.count.subscribe(listener);

        counter.increment();
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        counter.increment();
        expect(listener).toHaveBeenCalledTimes(1); // No additional calls
      });

      it('should maintain state consistency across components', () => {
        const adapter = createAdapter(createInitialState());

        const Reader: ComponentFactory<TestState> = ({ store, computed }) => ({
          getAll: computed(() => ({
            count: store.count(),
            text: store.text(),
            nested: store.nested(),
            list: store.list(),
          })),
          getCount: store.count,
          getText: store.text,
        });

        const Writer: ComponentFactory<TestState> = ({ store, set }) => ({
          setCount: (count: number) => set(store.count, count),
          setText: (text: string) => set(store.text, text),
          reset: () => {
            const initial = createInitialState();
            set(store.count, initial.count);
            set(store.text, initial.text);
            set(store.nested, initial.nested);
            set(store.list, initial.list);
          },
        });

        const reader = createStoreWithAdapter(adapter)(Reader);
        const writer = createStoreWithAdapter(adapter)(Writer);

        // Modify through writer
        writer.setCount(10);
        writer.setText('modified');

        // Read through reader - should see updates
        expect(reader.getCount()).toBe(10);
        expect(reader.getText()).toBe('modified');

        const fullState = reader.getAll();
        expect(fullState.count).toBe(10);
        expect(fullState.text).toBe('modified');
        expect(fullState.nested).toEqual({ value: 42, flag: true });
      });
    });

    describe('Edge Cases and Error Scenarios', () => {
      let adapter: StoreAdapter<TestState>;

      beforeEach(() => {
        adapter = createAdapter<TestState>();
        adapter.setState(createInitialState());
      });

      it('should handle rapid successive updates', () => {
        const listener = vi.fn();
        adapter.subscribe(listener);

        // Rapid updates
        for (let i = 0; i < 100; i++) {
          adapter.setState({ count: i });
        }

        expect(adapter.getState().count).toBe(99);
        expect(listener).toHaveBeenCalledTimes(100);
      });

      it('should handle concurrent subscriptions and unsubscriptions', () => {
        const listeners = Array.from({ length: 10 }, () => vi.fn());
        const unsubscribes: Array<() => void> = [];

        // Subscribe all
        listeners.forEach((listener) => {
          unsubscribes.push(adapter.subscribe(listener));
        });

        // Update once
        adapter.setState({ count: 1 });
        listeners.forEach((listener) => {
          expect(listener).toHaveBeenCalledTimes(1);
        });

        // Unsubscribe half
        unsubscribes.slice(0, 5).forEach((unsub) => unsub());

        // Update again
        adapter.setState({ count: 2 });
        listeners.slice(0, 5).forEach((listener) => {
          expect(listener).toHaveBeenCalledTimes(1); // Not called again
        });
        listeners.slice(5).forEach((listener) => {
          expect(listener).toHaveBeenCalledTimes(2); // Called again
        });
      });

      it('should handle subscribing during notification', () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();
        let unsubscribe2: (() => void) | null = null;

        // First listener subscribes a second listener
        adapter.subscribe(() => {
          listener1();
          if (!unsubscribe2) {
            unsubscribe2 = adapter.subscribe(listener2);
          }
        });

        adapter.setState({ count: 1 });
        expect(listener1).toHaveBeenCalledTimes(1);
        // listener2 may or may not be called in the same cycle
        // This is implementation-dependent

        adapter.setState({ count: 2 });
        expect(listener1).toHaveBeenCalledTimes(2);
        expect(listener2.mock.calls.length).toBeGreaterThan(0); // Called at least once
      });

      it('should handle errors in listeners gracefully', () => {
        const goodListener1 = vi.fn();
        const badListener = vi.fn(() => {
          throw new Error('Listener error');
        });
        const goodListener2 = vi.fn();

        adapter.subscribe(goodListener1);
        adapter.subscribe(badListener);
        adapter.subscribe(goodListener2);

        // Should not throw and other listeners should still be called
        expect(() => adapter.setState({ count: 1 })).not.toThrow();

        expect(goodListener1).toHaveBeenCalled();
        expect(badListener).toHaveBeenCalled();
        expect(goodListener2).toHaveBeenCalled();
      });

      it('should handle setting the same state multiple times', () => {
        const listener = vi.fn();
        adapter.subscribe(listener);

        const state = { count: 42 };
        adapter.setState(state);
        adapter.setState(state);
        adapter.setState(state);

        expect(adapter.getState().count).toBe(42);
        // Listener should be called each time even if state value is the same
        // This is because adapters work with partial updates
        expect(listener).toHaveBeenCalledTimes(3);
      });
    });

    describe('Type Safety', () => {
      it('should maintain type safety for state operations', () => {
        interface TypedState {
          num: number;
          str: string;
          bool: boolean;
          obj: { nested: number };
          arr: string[];
        }

        const adapter = createAdapter<TypedState>();
        const initial: TypedState = {
          num: 42,
          str: 'hello',
          bool: true,
          obj: { nested: 1 },
          arr: ['a', 'b'],
        };

        adapter.setState(initial);

        // These should compile without type errors
        adapter.setState({ num: 100 });
        adapter.setState({ str: 'world' });
        adapter.setState({ bool: false });
        adapter.setState({ obj: { nested: 2 } });
        adapter.setState({ arr: ['x', 'y', 'z'] });

        // Partial updates
        adapter.setState({ num: 200, str: 'test' });

        const state = adapter.getState();
        expect(state.num).toBe(200);
        expect(state.str).toBe('test');
        expect(state.bool).toBe(false);
        expect(state.obj.nested).toBe(2);
        expect(state.arr).toEqual(['x', 'y', 'z']);
      });
    });
  });
}
