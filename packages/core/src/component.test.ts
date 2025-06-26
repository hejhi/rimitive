import { describe, it, expect } from 'vitest';
import { createComponent, createStore } from './component';
import type { Signal, Computed } from './runtime-types';

describe('Component API', () => {
  it('should create a basic component with signals', () => {
    type CounterState = { count: number };
    
    interface CounterSlices {
      count: Signal<number>;
      doubled: Computed<number>;
      increment: () => void;
      reset: () => void;
    }
    
    const Counter = createComponent<CounterState, CounterSlices>(({ count }, set, { computed }) => {
      const doubled = computed(() => count() * 2);
      
      return {
        count,
        doubled,
        increment: () => set({ count: count() + 1 }),
        reset: () => set({ count: 0 })
      };
    });
    
    const store = createStore(Counter, { count: 5 });
    
    expect(store.count()).toBe(5);
    expect(store.doubled()).toBe(10);
    
    store.increment();
    expect(store.count()).toBe(6);
    expect(store.doubled()).toBe(12);
    
    store.reset();
    expect(store.count()).toBe(0);
    expect(store.doubled()).toBe(0);
  });
  
  it('should support component composition', () => {
    type CounterState = { count: number };
    interface CounterSlices {
      count: Signal<number>;
      increment: () => void;
    }
    
    const Counter = createComponent<CounterState, CounterSlices>(({ count }, set) => {
      return {
        count,
        increment: () => set({ count: count() + 1 })
      };
    });
    
    type AppState = { count: number; multiplier: number };
    interface AppSlices {
      subCount: Signal<number>;
      multiplier: Signal<number>;
      total: Computed<number>;
      increment: () => void;
      setMultiplier: (n: number) => void;
    }
    
    const App = createComponent<AppState, AppSlices>((state, set, lattice) => {
      const { computed } = lattice;
      
      // Compose Counter
      const { count: subCount, increment } = Counter(state, set, lattice);
      
      // Local state - using passed-in state
      const { multiplier } = state;
      
      // Computed that uses composed state
      const total = computed(() => subCount() * multiplier());
      
      return {
        subCount,
        multiplier,
        total,
        increment,
        setMultiplier: (n: number) => set({ multiplier: n })
      };
    });
    
    const store = createStore(App, { count: 3, multiplier: 4 });
    
    expect(store.subCount()).toBe(3);
    expect(store.multiplier()).toBe(4);
    expect(store.total()).toBe(12);
    
    store.increment();
    expect(store.subCount()).toBe(4);
    expect(store.total()).toBe(16);
    
    store.setMultiplier(3);
    expect(store.multiplier()).toBe(3);
    expect(store.total()).toBe(12);
  });
  
  it('should properly track dependencies in computed values', () => {
    type TodoState = { todos: string[]; filter: 'all' | 'active' | 'done' };
    interface TodoSlices {
      todos: Signal<string[]>;
      filter: Signal<'all' | 'active' | 'done'>;
      filtered: Computed<string[]>;
      addTodo: (text: string) => void;
      setFilter: (f: 'all' | 'active' | 'done') => void;
    }
    
    const TodoApp = createComponent<TodoState, TodoSlices>(({ todos, filter }, set, { computed }) => {
      const filtered = computed(() => {
        const f = filter();
        const t = todos();
        if (f === 'all') return t;
        // Simplified for test
        return t.filter((todo: string) => f === 'active' ? !todo.includes('[done]') : todo.includes('[done]'));
      });
      
      return {
        todos,
        filter,
        filtered,
        addTodo: (text: string) => set({ todos: [...todos(), text] }),
        setFilter: (f: 'all' | 'active' | 'done') => set({ filter: f })
      };
    });
    
    const store = createStore(TodoApp, { todos: [], filter: 'all' });
    
    store.addTodo('Buy milk');
    store.addTodo('[done] Read book');
    
    expect(store.filtered()).toEqual(['Buy milk', '[done] Read book']);
    
    store.setFilter('active');
    expect(store.filtered()).toEqual(['Buy milk']);
    
    store.setFilter('done');
    expect(store.filtered()).toEqual(['[done] Read book']);
  });
  
  it('should support fine-grained subscriptions', () => {
    type CounterState = { count: number; name: string };
    interface CounterSlices {
      count: Signal<number>;
      name: Signal<string>;
      increment: () => void;
      setName: (n: string) => void;
    }
    
    const Counter = createComponent<CounterState, CounterSlices>(({ count, name }, set) => {
      return {
        count,
        name,
        increment: () => set({ count: count() + 1 }),
        setName: (n: string) => set({ name: n })
      };
    });
    
    const store = createStore(Counter, { count: 0, name: 'initial' });
    
    let countUpdates = 0;
    let nameUpdates = 0;
    
    const unsubCount = store.count.subscribe(() => countUpdates++);
    const unsubName = store.name.subscribe(() => nameUpdates++);
    
    store.increment();
    expect(countUpdates).toBe(1);
    expect(nameUpdates).toBe(0);
    
    store.setName('updated');
    expect(countUpdates).toBe(1);
    expect(nameUpdates).toBe(1);
    
    unsubCount();
    unsubName();
    
    store.increment();
    expect(countUpdates).toBe(1);
    expect(nameUpdates).toBe(1);
  });
});