import { describe, expect, it } from 'vitest';
import { createLatticeStore, computed, signal } from './runtime';
import type { StoreAdapter } from './adapter-contract';

describe('runtime integration', () => {
  // Helper to create a test adapter
  const createTestAdapter = <State>(
    initialState: State
  ): StoreAdapter<State> => {
    let state = { ...initialState };
    const listeners = new Set<() => void>();

    return {
      getState: () => state,
      setState: (updates) => {
        state = { ...state, ...updates };
        listeners.forEach((listener) => listener());
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };

  it('should create slices with signals-based API', () => {
    const adapter = createTestAdapter({ count: 0, name: 'test' });
    const createSlice = createLatticeStore(adapter);

    const counter = createSlice(({ count }, set) => ({
      value: count,
      increment: () => set({ count: count() + 1 }),
      decrement: () => set({ count: count() - 1 }),
    }));

    // Test initial values
    expect(counter().value()).toBe(0);

    // Test mutations
    counter().increment();
    expect(counter().value()).toBe(1);

    counter().decrement();
    expect(counter().value()).toBe(0);
  });

  it('should sync signals with adapter unidirectionally', () => {
    const adapter = createTestAdapter({ count: 5 });
    const createSlice = createLatticeStore(adapter);

    const counter = createSlice(({ count }, set) => ({
      value: count,
      setValue: (v: number) => set({ count: v }),
    }));

    // Initial value from adapter
    expect(counter().value()).toBe(5);
    expect(adapter.getState().count).toBe(5);

    // Set updates adapter, which then updates signal
    counter().setValue(10);
    expect(adapter.getState().count).toBe(10);
    expect(counter().value()).toBe(10);

    // Adapter change updates signal
    adapter.setState({ count: 15 });
    expect(counter().value()).toBe(15);
  });

  it('should support computed values in slices', () => {
    const adapter = createTestAdapter({ first: 'Hello', last: 'World' });
    const createSlice = createLatticeStore(adapter);

    const nameSlice = createSlice(({ first, last }, set) => {
      const fullName = computed(() => `${first()} ${last()}`);
      const initials = computed(() => `${first()[0]}.${last()[0]}.`);

      return {
        first,
        last,
        fullName,
        initials,
        setFirst: (value: string) => set({ first: value }),
        setLast: (value: string) => set({ last: value }),
      };
    });

    // Test initial computed values
    expect(nameSlice().fullName()).toBe('Hello World');
    expect(nameSlice().initials()).toBe('H.W.');

    // Test computed updates when signals change
    nameSlice().setFirst('John');
    expect(nameSlice().fullName()).toBe('John World');
    expect(nameSlice().initials()).toBe('J.W.');

    nameSlice().setLast('Doe');
    expect(nameSlice().fullName()).toBe('John Doe');
    expect(nameSlice().initials()).toBe('J.D.');
  });

  it('should support slice composition', () => {
    const adapter = createTestAdapter({ count: 0, multiplier: 2 });
    const createSlice = createLatticeStore(adapter);

    // Base counter slice
    const counter = createSlice(({ count }, set) => ({
      value: count,
      increment: () => set({ count: count() + 1 }),
    }));

    // Multiplier slice that composes counter
    const multiplied = createSlice(({ multiplier }, set) => {
      // Extract specific methods from counter for composition
      const { value: counterValue } = counter(c => ({ value: c.value }));
      
      const result = computed(() => counterValue() * multiplier());
      
      return {
        result,
        counterValue,
        multiplier,
        setMultiplier: (v: number) => set({ multiplier: v }),
      };
    });

    // Test composition
    expect(multiplied().result()).toBe(0); // 0 * 2
    expect(multiplied().counterValue()).toBe(0);

    // Change counter, should affect composed slice
    counter().increment();
    expect(multiplied().result()).toBe(2); // 1 * 2
    expect(multiplied().counterValue()).toBe(1);

    // Change multiplier
    multiplied().setMultiplier(3);
    expect(multiplied().result()).toBe(3); // 1 * 3
  });

  it('should notify subscribers when signals change', () => {
    const adapter = createTestAdapter({ count: 0 });
    const createSlice = createLatticeStore(adapter);

    const counter = createSlice(({ count }, set) => ({
      value: count,
      increment: () => set({ count: count() + 1 }),
    }));

    let notificationCount = 0;
    const unsubscribe = counter().value.subscribe(() => {
      notificationCount++;
    });

    counter().increment();
    expect(notificationCount).toBe(1);

    counter().increment();
    expect(notificationCount).toBe(2);

    unsubscribe();
    counter().increment();
    expect(notificationCount).toBe(2); // Should not notify after unsubscribe
  });

  it('should handle new state properties dynamically', () => {
    const adapter = createTestAdapter({ count: 0 } as { count: number; name?: string });
    const createSlice = createLatticeStore(adapter);

    // Add new property to state
    adapter.setState({ name: 'test' });

    // Create new slice that can access the new property
    const newSlice = createSlice((state, set) => ({
      name: state.name || signal(''),
      count: state.count,
      setName: (v: string) => set({ name: v }),
    }));

    expect(newSlice().name()).toBe('test');
    
    newSlice().setName('updated');
    expect(newSlice().name()).toBe('updated');
  });
});