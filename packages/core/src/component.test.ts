import { describe, it, expect, vi } from 'vitest';
import { createComponent, withState, createStore } from './component';
import { withLogger } from './middleware';

describe('Component API', () => {
  it('should create a component with inferred state from callback', () => {
    const Counter = createComponent(
      withState(() => ({ count: 0 })),
      ({ store, computed, set }) => {
        const doubled = computed(() => store.count() * 2);
        
        return {
          count: store.count,
          doubled,
          increment: () => set({ count: store.count() + 1 }),
          reset: () => set({ count: 0 })
        };
      }
    );
    
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
  
  it('should support middleware composition with new pattern', () => {
    const Counter = createComponent(
      withLogger(withState(() => ({ count: 0 }))),
      ({ store, set }) => ({
        count: store.count,
        increment: () => set({ count: store.count() + 1 })
      })
    );
    
    const store = createStore(Counter, { count: 5 });
    
    // Spy on console.log to verify logger works
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    store.increment();
    expect(store.count()).toBe(6);
    expect(consoleSpy).toHaveBeenCalledWith('[Lattice Logger] State update:', { count: 6 });
    
    consoleSpy.mockRestore();
  });
  
  it('should support composition with new API', () => {
    const SubCounter = createComponent(
      withState(() => ({ subCount: 0 })),
      ({ store, set }) => ({
        value: store.subCount,
        inc: () => set({ subCount: store.subCount() + 1 })
      })
    );
    
    const App = createComponent(
      withState(() => ({ subCount: 0, multiplier: 2 })),
      (context) => {
        const sub = SubCounter(context);
        const total = context.computed(() => sub.value() * context.store.multiplier());
        
        return {
          counter: sub,
          multiplier: context.store.multiplier,
          total,
          setMultiplier: (n: number) => context.set({ multiplier: n })
        };
      }
    );
    
    const store = createStore(App, { subCount: 5, multiplier: 3 });
    expect(store.total()).toBe(15);
    
    store.counter.inc();
    expect(store.total()).toBe(18);
    
    store.setMultiplier(2);
    expect(store.total()).toBe(12);
  });
  
  it('should properly track dependencies in computed values', () => {
    type TodoState = { todos: string[]; filter: 'all' | 'active' | 'done' };
    
    const TodoApp = createComponent(
      withState<TodoState>(),
      ({ store, computed, set }) => {
        const filtered = computed(() => {
          const f = store.filter();
          const t = store.todos();
          if (f === 'all') return t;
          // Simplified for test
          return t.filter((todo: string) => f === 'active' ? !todo.includes('[done]') : todo.includes('[done]'));
        });
        
        return {
          todos: store.todos,
          filter: store.filter,
          filtered,
          addTodo: (text: string) => set({ todos: [...store.todos(), text] }),
          setFilter: (f: 'all' | 'active' | 'done') => set({ filter: f })
        };
      }
    );
    
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
    
    const Counter = createComponent(
      withState<CounterState>(),
      ({ store, set }) => {
        return {
          count: store.count,
          name: store.name,
          increment: () => set({ count: store.count() + 1 }),
          setName: (n: string) => set({ name: n })
        };
      }
    );
    
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