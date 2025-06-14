import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { createStore } from '@lattice/core';
import { useSliceSelector, useSliceValues, useSlice, useLattice } from './vue.js';

describe('Vue composables', () => {
  // Create a test store
  const createTestStore = () => {
    const createSlice = createStore({
      count: 0,
      name: 'test',
      items: [] as string[],
    });

    const listeners = new Set<() => void>();

    const counter = createSlice(({ get, set }) => ({
      value: () => get().count,
      increment: () => {
        set({ count: get().count + 1 });
        listeners.forEach((l) => l());
      },
      isEven: () => get().count % 2 === 0,
    }));

    const user = createSlice(({ get, set }) => ({
      name: () => get().name,
      setName: (name: string) => {
        set({ name });
        listeners.forEach((l) => l());
      },
    }));

    const items = createSlice(({ get, set }) => ({
      all: () => get().items,
      add: (item: string) => {
        set({ items: [...get().items, item] });
        listeners.forEach((l) => l());
      },
    }));

    return {
      counter,
      user,
      items,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };

  describe('useSliceSelector', () => {
    it('should return selected values and update on changes', async () => {
      const store = createTestStore();

      const TestComponent = defineComponent({
        setup() {
          const data = useSliceSelector(store, (s) => ({
            count: s.counter.value(),
            isEven: s.counter.isEven(),
          }));

          return { data };
        },
        template: '<div>{{ data }}</div>',
      });

      const wrapper = mount(TestComponent);

      expect(wrapper.vm.data).toEqual({ count: 0, isEven: true });

      // Update store
      store.counter.increment();
      await nextTick();

      expect(wrapper.vm.data).toEqual({ count: 1, isEven: false });
    });

    it('should not update for unrelated changes', async () => {
      const store = createTestStore();
      let renderCount = 0;

      const TestComponent = defineComponent({
        setup() {
          renderCount++;
          const count = useSliceSelector(store, (s) => s.counter.value());
          return { count };
        },
        template: '<div>{{ count }}</div>',
      });

      const wrapper = mount(TestComponent);
      const initialRenderCount = renderCount;

      expect(wrapper.vm.count).toBe(0);

      // Change unrelated state
      store.user.setName('alice');
      await nextTick();

      // Should not trigger re-render
      expect(renderCount).toBe(initialRenderCount);
      expect(wrapper.vm.count).toBe(0);

      // Change selected state
      store.counter.increment();
      await nextTick();

      expect(wrapper.vm.count).toBe(1);
    });

    it('should clean up subscription on unmount', () => {
      const store = createTestStore();
      let unsubscribeCalled = false;
      const originalSubscribe = store.subscribe;

      // Mock subscribe to track unsubscribe calls
      store.subscribe = vi.fn((listener) => {
        const unsubscribe = originalSubscribe(listener);
        return () => {
          unsubscribeCalled = true;
          return unsubscribe();
        };
      });

      const TestComponent = defineComponent({
        setup() {
          const count = useSliceSelector(store, (s) => s.counter.value());
          return { count };
        },
        template: '<div>{{ count }}</div>',
      });

      const wrapper = mount(TestComponent);
      expect(store.subscribe).toHaveBeenCalledTimes(1);
      expect(unsubscribeCalled).toBe(false);

      // Unmount should call unsubscribe
      wrapper.unmount();
      expect(unsubscribeCalled).toBe(true);
    });
  });

  describe('useSliceValues', () => {
    it('should use shallow equality by default and support destructuring', async () => {
      const store = createTestStore();

      const TestComponent = defineComponent({
        setup() {
          const { count, name } = useSliceValues(store, (s) => ({
            count: s.counter.value(),
            name: s.user.name(),
          }));

          return { count, name };
        },
        template: '<div>Count: {{ count }}, Name: {{ name }}</div>',
      });

      const wrapper = mount(TestComponent);

      expect(wrapper.vm.count).toBe(0);
      expect(wrapper.vm.name).toBe('test');

      // Update values
      store.counter.increment();
      await nextTick();

      expect(wrapper.vm.count).toBe(1);
      expect(wrapper.vm.name).toBe('test');

      store.user.setName('alice');
      await nextTick();

      expect(wrapper.vm.count).toBe(1);
      expect(wrapper.vm.name).toBe('alice');
    });

    it('should handle multiple updates correctly', async () => {
      const store = createTestStore();

      const TestComponent = defineComponent({
        setup() {
          const values = useSliceValues(store, (s) => ({
            count: s.counter.value(),
            name: s.user.name(),
          }));

          return values;
        },
        template: '<div>{{ count }} {{ name }}</div>',
      });

      const wrapper = mount(TestComponent);

      // Multiple updates
      store.counter.increment();
      store.counter.increment();
      store.user.setName('bob');
      store.counter.increment();
      await nextTick();

      expect(wrapper.vm.count).toBe(3);
      expect(wrapper.vm.name).toBe('bob');
    });
  });

  describe('useSlice', () => {
    it('should return a single slice directly', () => {
      const store = createTestStore();

      const TestComponent = defineComponent({
        setup() {
          const counter = useSlice(store, 'counter');
          return { counter };
        },
        template: '<div>{{ counter.value() }}</div>',
      });

      const wrapper = mount(TestComponent);

      expect(wrapper.vm.counter).toBe(store.counter);
      expect(wrapper.vm.counter.value()).toBe(0);

      // Can call methods on the slice
      wrapper.vm.counter.increment();
      expect(wrapper.vm.counter.value()).toBe(1);
    });
  });

  describe('useLattice', () => {
    it('should provide both values and slices', async () => {
      const store = createTestStore();

      const TestComponent = defineComponent({
        setup() {
          const { values, slices } = useLattice(store, (s) => ({
            count: s.counter.value(),
          }));

          return { values, slices };
        },
        template: '<div>{{ values.count }}</div>',
      });

      const wrapper = mount(TestComponent);

      expect(wrapper.vm.values.count).toBe(0);
      expect(wrapper.vm.slices).toBe(store);

      // Can use slices to trigger actions
      wrapper.vm.slices.counter.increment();
      await nextTick();

      expect(wrapper.vm.values.count).toBe(1);
    });

    it('should support custom equality function', async () => {
      const store = createTestStore();
      const customEqual = vi.fn(
        (a: number, b: number) => Math.abs(a - b) < 3
      );

      const TestComponent = defineComponent({
        setup() {
          const { values } = useLattice(
            store,
            (s) => s.counter.value(),
            customEqual
          );

          return { values };
        },
        template: '<div>{{ values }}</div>',
      });

      const wrapper = mount(TestComponent);

      // Initial value - values is a ref containing the primitive
      expect(wrapper.vm.values).toBe(0);

      // Small changes should not trigger updates
      store.counter.increment(); // 1
      store.counter.increment(); // 2
      await nextTick();

      // Custom equality function should have been called
      expect(customEqual).toHaveBeenCalled();

      // Should still be 0 due to custom equality (diff < 3)
      expect(wrapper.vm.values).toBe(0);

      // This change triggers update (diff = 3, which is NOT < 3)
      store.counter.increment(); // 3
      await nextTick();

      // Should update to 3
      expect(wrapper.vm.values).toBe(3);

      // Small change from 3 should not trigger update
      store.counter.increment(); // 4
      store.counter.increment(); // 5
      await nextTick();

      // Should still be 3 (diff < 3)
      expect(wrapper.vm.values).toBe(3);
    });
  });
});