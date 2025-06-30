import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, watch, nextTick, computed } from 'vue';
import { createStore, type ComponentFactory } from '@lattice/core';
import { useStore, useSignal, provideLatticeStore, injectLatticeStore } from './vue.js';

describe('Vue Lattice composables', () => {
  // Create test components
  const createTestStores = () => {
    const Counter: ComponentFactory<{ count: number }, any> = ({ store, computed, set }) => ({
      value: store.count,
      increment: () => set(store.count, store.count() + 1),
      doubled: computed(() => store.count() * 2),
      isEven: computed(() => store.count() % 2 === 0),
    });

    const User: ComponentFactory<{ name: string }, any> = ({ store, set }) => ({
      name: store.name,
      setName: (newName: string) => set(store.name, newName),
    });

    const Items: ComponentFactory<{ items: string[] }, any> = ({ store, computed, set }) => ({
      all: store.items,
      add: (item: string) => set(store.items, [...store.items(), item]),
      count: computed(() => store.items().length),
      first: computed(() => store.items()[0] || null),
    });

    return {
      counterStore: createStore(Counter, { count: 0 }),
      userStore: createStore(User, { name: 'test' }),
      itemsStore: createStore(Items, { items: [] }),
    };
  };

  describe('useStore', () => {
    it('should make store reactive and track dependencies', async () => {
      const { counterStore } = createTestStores();

      const TestComponent = defineComponent({
        setup() {
          const store = useStore(counterStore);
          const doubleComputed = computed(() => store.value.value() * 2);
          return { store, doubleComputed };
        },
        template: '<div>{{ store.value() }} - {{ doubleComputed }}</div>',
      });

      const wrapper = mount(TestComponent);
      expect(wrapper.text()).toBe('0 - 0');

      counterStore.increment();
      await nextTick();
      expect(wrapper.text()).toBe('1 - 2');

      counterStore.increment();
      await nextTick();
      expect(wrapper.text()).toBe('2 - 4');
    });

    it('should work with watch', async () => {
      const { userStore } = createTestStores();
      const watchedValues: string[] = [];

      const TestComponent = defineComponent({
        setup() {
          const store = useStore(userStore);
          
          watch(
            () => store.value.name(),
            (newVal) => {
              watchedValues.push(newVal);
            }
          );
          
          return { store };
        },
        template: '<div>{{ store.name() }}</div>',
      });

      mount(TestComponent);
      
      userStore.setName('Alice');
      await nextTick();
      
      userStore.setName('Bob');
      await nextTick();
      
      expect(watchedValues).toEqual(['Alice', 'Bob']);
    });

    it('should work with selectors', async () => {
      const { itemsStore } = createTestStores();

      const TestComponent = defineComponent({
        setup() {
          const count = useStore(itemsStore, s => s.count);
          const first = useStore(itemsStore, s => s.first);
          
          return { count, first };
        },
        template: '<div>Count: {{ count() }}, First: {{ first() || "none" }}</div>',
      });

      const wrapper = mount(TestComponent);
      expect(wrapper.text()).toBe('Count: 0, First: none');

      itemsStore.add('apple');
      await nextTick();
      expect(wrapper.text()).toBe('Count: 1, First: apple');

      itemsStore.add('banana');
      await nextTick();
      expect(wrapper.text()).toBe('Count: 2, First: apple');
    });
  });

  describe('useSignal', () => {
    it('should make individual signals reactive', async () => {
      const { counterStore } = createTestStores();

      const TestComponent = defineComponent({
        setup() {
          const value = useSignal(counterStore.value);
          const doubled = useSignal(counterStore.doubled);
          
          return { value, doubled };
        },
        template: '<div>{{ value }} - {{ doubled }}</div>',
      });

      const wrapper = mount(TestComponent);
      expect(wrapper.text()).toBe('0 - 0');

      counterStore.increment();
      await nextTick();
      expect(wrapper.text()).toBe('1 - 2');
    });
  });

  describe('provide/inject', () => {
    it('should share store across components', async () => {
      const { counterStore } = createTestStores();

      const ChildComponent = defineComponent({
        setup() {
          const injectedStore = injectLatticeStore<typeof counterStore>('counter');
          const store = useStore(injectedStore);
          return { store };
        },
        template: '<div>Child: {{ store.value() }}</div>',
      });

      const ParentComponent = defineComponent({
        components: { ChildComponent },
        setup() {
          provideLatticeStore('counter', counterStore);
          const store = useStore(counterStore);
          return { store };
        },
        template: '<div>Parent: {{ store.value() }} <ChildComponent /></div>',
      });

      const wrapper = mount(ParentComponent);
      expect(wrapper.text()).toBe('Parent: 0 Child: 0');

      counterStore.increment();
      await nextTick();
      expect(wrapper.text()).toBe('Parent: 1 Child: 1');
    });
  });

  describe('cleanup', () => {
    it('should unsubscribe when component unmounts', async () => {
      const { counterStore } = createTestStores();
      let subscriptionCount = 0;
      
      // Spy on subscribe method
      const originalSubscribe = counterStore.value.subscribe;
      counterStore.value.subscribe = (fn: () => void) => {
        subscriptionCount++;
        const unsub = originalSubscribe.call(counterStore.value, fn);
        return () => {
          subscriptionCount--;
          unsub();
        };
      };

      const TestComponent = defineComponent({
        setup() {
          const value = useSignal(counterStore.value);
          return { value };
        },
        template: '<div>{{ value }}</div>',
      });

      const wrapper = mount(TestComponent);
      expect(subscriptionCount).toBe(1);

      wrapper.unmount();
      expect(subscriptionCount).toBe(0);
    });
  });
});