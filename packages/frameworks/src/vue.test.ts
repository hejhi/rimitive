import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, watch, nextTick, computed } from 'vue';
import { createStore, computed as latticeComputed } from '@lattice/core';
import { useSlice, useLatticeReactive, provideLatticeSlice, injectLatticeSlice } from './vue.js';

describe('Vue Lattice composables - New slice-based API', () => {
  // Create test slices
  const createTestSlices = () => {
    const createSlice = createStore({
      count: 0,
      name: 'test',
      items: [] as string[],
    });

    const counterSlice = createSlice(({ count }, set) => ({
      value: count, // count is already a signal
      increment: () => set({ count: count() + 1 }),
      doubled: latticeComputed(() => count() * 2),
      isEven: latticeComputed(() => count() % 2 === 0),
    }));

    const userSlice = createSlice(({ name }, set) => ({
      name, // name is already a signal
      setName: (newName: string) => set({ name: newName }),
    }));

    const itemsSlice = createSlice(({ items }, set) => ({
      all: items, // items is already a signal
      add: (item: string) => set({ items: [...items(), item] }),
    }));

    return { counterSlice, userSlice, itemsSlice };
  };

  describe('useSlice', () => {
    it('should return a reactive ref that updates when slice changes', async () => {
      const { counterSlice } = createTestSlices();

      const TestComponent = defineComponent({
        setup() {
          const count = useSlice(counterSlice, c => c.value());
          const doubled = useSlice(counterSlice, c => c.doubled());

          return { count, doubled };
        },
        template: '<div>{{ count }} {{ doubled }}</div>',
      });

      const wrapper = mount(TestComponent);
      expect(wrapper.text()).toBe('0 0');

      // Trigger slice action
      counterSlice().increment();
      await nextTick();
      expect(wrapper.text()).toBe('1 2');

      counterSlice().increment();
      await nextTick();
      expect(wrapper.text()).toBe('2 4');
    });

    it('should work with Vue computed and watch', async () => {
      const { counterSlice } = createTestSlices();
      const watchedValues: number[] = [];

      const TestComponent = defineComponent({
        setup() {
          const count = useSlice(counterSlice, c => c.value());
          const tripled = computed(() => count.value * 3);
          
          watch(count, (newVal) => {
            watchedValues.push(newVal);
          });

          return { count, tripled };
        },
        template: '<div>{{ count }} {{ tripled }}</div>',
      });

      const wrapper = mount(TestComponent);
      expect(wrapper.text()).toBe('0 0');

      counterSlice().increment();
      await nextTick();
      expect(wrapper.text()).toBe('1 3');
      expect(watchedValues).toEqual([1]);

      counterSlice().increment();
      await nextTick();
      expect(wrapper.text()).toBe('2 6');
      expect(watchedValues).toEqual([1, 2]);
    });

    it('should have fine-grained reactivity (not update for unrelated changes)', async () => {
      const { counterSlice, userSlice } = createTestSlices();
      let renderCount = 0;

      const TestComponent = defineComponent({
        setup() {
          const count = useSlice(counterSlice, c => {
            renderCount++;
            return c.value();
          });

          return { count };
        },
        template: '<div>{{ count }}</div>',
      });

      const wrapper = mount(TestComponent);
      expect(wrapper.text()).toBe('0');
      expect(renderCount).toBe(1);

      // Change unrelated slice - should NOT trigger re-render
      userSlice().setName('alice');
      await nextTick();
      expect(wrapper.text()).toBe('0');
      expect(renderCount).toBe(1); // Still 1!

      // Change related slice - should trigger re-render
      counterSlice().increment();
      await nextTick();
      expect(wrapper.text()).toBe('1');
      expect(renderCount).toBe(2); // Now 2
    });
  });

  describe('useLatticeReactive', () => {
    it('should return reactive object with multiple values', async () => {
      const { counterSlice } = createTestSlices();

      const TestComponent = defineComponent({
        setup() {
          const counter = useLatticeReactive(counterSlice, c => ({
            value: c.value(),
            doubled: c.doubled(),
            isEven: c.isEven(),
          }));

          return { counter };
        },
        template: '<div>{{ counter.value }} {{ counter.doubled }} {{ counter.isEven }}</div>',
      });

      const wrapper = mount(TestComponent);
      expect(wrapper.text()).toBe('0 0 true');

      counterSlice().increment();
      await nextTick();
      expect(wrapper.text()).toBe('1 2 false');

      counterSlice().increment();
      await nextTick();
      expect(wrapper.text()).toBe('2 4 true');
    });

    it('should work with computed refs based on reactive object', async () => {
      const { counterSlice } = createTestSlices();

      const TestComponent = defineComponent({
        setup() {
          const counter = useLatticeReactive(counterSlice, c => ({
            value: c.value(),
            doubled: c.doubled(),
          }));

          const tripled = computed(() => counter.value.value * 3);
          const quadrupled = computed(() => counter.value.doubled * 2);

          return { counter, tripled, quadrupled };
        },
        template: '<div>{{ counter.value }} {{ tripled }} {{ quadrupled }}</div>',
      });

      const wrapper = mount(TestComponent);
      expect(wrapper.text()).toBe('0 0 0');

      counterSlice().increment();
      await nextTick();
      expect(wrapper.text()).toBe('1 3 4');
    });
  });

  describe('Dependency injection', () => {
    it('should provide and inject slices across component tree', async () => {
      const { counterSlice } = createTestSlices();

      // Define proper type for the slice
      type CounterSlice = typeof counterSlice;

      const ChildComponent = defineComponent({
        setup() {
          const counter = injectLatticeSlice<ReturnType<CounterSlice>>('test-counter');
          const count = useSlice(counter, (c: any) => c.value());
          
          return { count, counter };
        },
        template: '<button @click="counter().increment()">{{ count }}</button>',
      });

      const ParentComponent = defineComponent({
        setup() {
          provideLatticeSlice('test-counter', counterSlice);
          return {};
        },
        template: '<ChildComponent />',
        components: { ChildComponent },
      });

      const wrapper = mount(ParentComponent);
      expect(wrapper.text()).toBe('0');

      // Click button to increment
      await wrapper.find('button').trigger('click');
      await nextTick();
      expect(wrapper.text()).toBe('1');
    });

    it('should throw error when injecting non-provided slice', () => {
      const TestComponent = defineComponent({
        setup() {
          expect(() => {
            injectLatticeSlice('non-existent');
          }).toThrow('Lattice slice with key "non-existent" was not found in the component tree');
          
          return {};
        },
        template: '<div></div>',
      });

      mount(TestComponent);
    });
  });

  describe('Vue ecosystem integration', () => {
    it('should work seamlessly with watch', async () => {
      const { counterSlice } = createTestSlices();
      const watchedValues: number[] = [];

      const TestComponent = defineComponent({
        setup() {
          const count = useSlice(counterSlice, c => c.value());
          const doubled = useSlice(counterSlice, c => c.doubled());
          
          watch([count, doubled], ([newCount, newDoubled]) => {
            watchedValues.push(newCount, newDoubled);
          });

          return { count, doubled };
        },
        template: '<div>{{ count }} {{ doubled }}</div>',
      });

      mount(TestComponent);

      counterSlice().increment();
      await nextTick();
      expect(watchedValues).toEqual([1, 2]);

      counterSlice().increment();
      await nextTick();
      expect(watchedValues).toEqual([1, 2, 2, 4]);
    });

  });
});