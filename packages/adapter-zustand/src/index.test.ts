import { describe, it, expect, vi } from 'vitest';
import type { CreateStore } from '@lattice/core';
import { compose } from '@lattice/core';
import { createZustandAdapter } from '.';

describe('Zustand Adapter - New Architecture', () => {
  it('should demonstrate basic store creation and slice patterns', () => {
    // Define a simple counter app using the new API
    const createApp = (createStore: CreateStore<{ count: number }>) => {
      // Step 1: Create store returns a slice factory
      const createSlice = createStore({ count: 0 });

      // Step 2: Create slices - focused interfaces to the store
      // Actions slice - methods that mutate state
      const actions = createSlice(({ get, set }) => ({
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
        reset: () => set({ count: 0 }),
        setCount: (value: number) => set({ count: value }),
      }));

      // Query slice - methods that read state
      const queries = createSlice(({ get }) => ({
        count: () => get().count,
        isPositive: () => get().count > 0,
        isNegative: () => get().count < 0,
        isZero: () => get().count === 0,
      }));

      // Step 3: Create view slices that compute values
      const views = createSlice(({ get }) => ({
        // Direct computed values as methods
        computed: () => ({
          value: get().count,
          label: `Count: ${get().count}`,
          sign:
            get().count > 0
              ? 'positive'
              : get().count < 0
                ? 'negative'
                : 'zero',
        }),
        // Parameterized view
        display: (format: 'short' | 'long') => {
          const count = get().count;
          return format === 'short'
            ? `${count}`
            : `The current count is ${count} (${count > 0 ? 'positive' : count < 0 ? 'negative' : 'zero'})`;
        },
      }));

      return {
        actions,
        queries,
        views,
      };
    };

    // Create the store using createZustandAdapter
    const store = createZustandAdapter(createApp);

    // Test initial state through queries
    expect(store.queries.count()).toBe(0);
    expect(store.queries.isZero()).toBe(true);
    expect(store.queries.isPositive()).toBe(false);
    expect(store.queries.isNegative()).toBe(false);

    // Test computed values (they're methods that return fresh data)
    const computed = store.views.computed();
    expect(computed.value).toBe(0);
    expect(computed.label).toBe('Count: 0');
    expect(computed.sign).toBe('zero');

    // Test parameterized views
    expect(store.views.display('short')).toBe('0');
    expect(store.views.display('long')).toBe('The current count is 0 (zero)');

    // Test actions
    store.actions.increment();
    expect(store.queries.count()).toBe(1);

    // Get fresh computed values
    const updated = store.views.computed();
    expect(updated.value).toBe(1);
    expect(updated.sign).toBe('positive');
    expect(store.views.display('short')).toBe('1');

    // Test multiple operations
    store.actions.increment();
    store.actions.increment();
    expect(store.queries.count()).toBe(3);

    store.actions.decrement();
    expect(store.queries.count()).toBe(2);

    store.actions.reset();
    expect(store.queries.count()).toBe(0);
    expect(store.queries.isZero()).toBe(true);

    store.actions.setCount(-5);
    expect(store.queries.count()).toBe(-5);
    expect(store.queries.isNegative()).toBe(true);
    expect(store.views.computed().sign).toBe('negative');
  });

  it('should demonstrate slice composition with compose', () => {
    const createApp = (
      createStore: CreateStore<{
        todos: { id: string; text: string; done: boolean }[];
        filter: 'all' | 'active' | 'completed';
      }>
    ) => {
      const createSlice = createStore({
        todos: [],
        filter: 'all',
      });

      // Base slices
      const todoQueries = createSlice(({ get }) => ({
        allTodos: () => get().todos,
        activeTodos: () => get().todos.filter((t) => !t.done),
        completedTodos: () => get().todos.filter((t) => t.done),
        getTodo: (id: string) => get().todos.find((t) => t.id === id),
      }));

      const filterQueries = createSlice(({ get }) => ({
        currentFilter: () => get().filter,
        isShowingAll: () => get().filter === 'all',
        isShowingActive: () => get().filter === 'active',
        isShowingCompleted: () => get().filter === 'completed',
      }));

      // Compose slices together for complex operations
      const todoActions = createSlice(
        compose(
          { todos: todoQueries, filter: filterQueries },
          ({ get, set }, { todos }) => ({
            addTodo: (text: string) => {
              const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const newTodo = { id, text, done: false };
              set({ todos: [...todos.allTodos(), newTodo] });
            },
            toggleTodo: (id: string) => {
              const todo = todos.getTodo(id);
              if (todo) {
                set({
                  todos: get().todos.map((t) =>
                    t.id === id ? { ...t, done: !t.done } : t
                  ),
                });
              }
            },
            removeTodo: (id: string) => {
              set({ todos: todos.allTodos().filter((t) => t.id !== id) });
            },
            clearCompleted: () => {
              set({ todos: todos.activeTodos() });
            },
          })
        )
      );

      const filterActions = createSlice(({ set }) => ({
        setFilter: (filter: 'all' | 'active' | 'completed') => set({ filter }),
      }));

      // Create view slice that computes values
      const views = createSlice(({ get }) => ({
        filteredTodos: () => {
          const filter = get().filter;
          const todos = get().todos;
          return filter === 'all'
            ? todos
            : filter === 'active'
              ? todos.filter((t) => !t.done)
              : todos.filter((t) => t.done);
        },
        stats: () => {
          const todos = get().todos;
          const active = todos.filter((t) => !t.done);
          const completed = todos.filter((t) => t.done);
          return {
            total: todos.length,
            active: active.length,
            completed: completed.length,
          };
        },
        summary: () => {
          const todos = get().todos;
          const active = todos.filter((t) => !t.done).length;
          const completed = todos.filter((t) => t.done).length;
          return `${active} active, ${completed} completed`;
        },
      }));

      return {
        actions: { ...todoActions, ...filterActions },
        queries: { ...todoQueries, ...filterQueries },
        views,
      };
    };

    const store = createZustandAdapter(createApp);

    // Test initial state
    expect(store.views.filteredTodos()).toEqual([]);
    expect(store.views.stats().total).toBe(0);

    // Add todos
    store.actions.addTodo('Learn Lattice');
    store.actions.addTodo('Build an app');

    expect(store.views.stats().total).toBe(2);
    expect(store.views.stats().active).toBe(2);
    expect(store.views.stats().completed).toBe(0);
    expect(store.views.summary()).toBe('2 active, 0 completed');

    // Toggle a todo
    const todos = store.queries.allTodos();
    store.actions.toggleTodo(todos[0]!.id);

    // Check the state after toggle
    const stats = store.views.stats();
    expect(stats.total).toBe(2);
    expect(stats.active).toBe(1);
    expect(stats.completed).toBe(1);

    // Test filtering
    store.actions.setFilter('active');
    const activeItems = store.views.filteredTodos();
    expect(activeItems.length).toBe(1);
    expect(activeItems[0]?.text).toBe('Build an app');

    store.actions.setFilter('completed');
    const completedItems = store.views.filteredTodos();
    expect(completedItems.length).toBe(1);
    expect(completedItems[0]?.text).toBe('Learn Lattice');

    // Clear completed
    store.actions.clearCompleted();
    expect(store.views.stats().total).toBe(1);
    expect(store.views.stats().completed).toBe(0);
  });

  it('should support subscriptions and demonstrate reactivity', () => {
    const createApp = (
      createStore: CreateStore<{ value: number; history: number[] }>
    ) => {
      const createSlice = createStore({
        value: 0,
        history: [],
      });

      const actions = createSlice(({ get, set }) => ({
        setValue: (value: number) => {
          const current = get();
          set({
            value,
            history: [...current.history, value],
          });
        },
        increment: () => {
          const current = get();
          const newValue = current.value + 1;
          set({
            value: newValue,
            history: [...current.history, newValue],
          });
        },
        reset: () => set({ value: 0, history: [] }),
      }));

      const queries = createSlice(({ get }) => ({
        current: () => get().value,
        history: () => get().history,
        hasHistory: () => get().history.length > 0,
        lastValue: () => {
          const hist = get().history;
          return hist.length > 1 ? hist[hist.length - 2] : null;
        },
      }));

      return { actions, queries };
    };

    const store = createZustandAdapter(createApp);

    // Track subscription calls
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    // Initial state
    expect(store.queries.current()).toBe(0);
    expect(store.queries.hasHistory()).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    // Update state
    store.actions.setValue(42);
    expect(store.queries.current()).toBe(42);
    expect(store.queries.history()).toEqual([42]);
    expect(listener).toHaveBeenCalledTimes(1);

    // Another update
    store.actions.increment();
    expect(store.queries.current()).toBe(43);
    expect(store.queries.history()).toEqual([42, 43]);
    expect(store.queries.lastValue()).toBe(42);
    expect(listener).toHaveBeenCalledTimes(2);

    // Multiple listeners
    const listener2 = vi.fn();
    const listener3 = vi.fn();
    const unsub2 = store.subscribe(listener2);
    const unsub3 = store.subscribe(listener3);

    store.actions.setValue(100);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener3).toHaveBeenCalledTimes(1);

    // Unsubscribe first listener
    unsubscribe();
    store.actions.reset();
    expect(listener).toHaveBeenCalledTimes(3); // No more calls
    expect(listener2).toHaveBeenCalledTimes(2);
    expect(listener3).toHaveBeenCalledTimes(2);

    // Cleanup
    unsub2();
    unsub3();
  });

  it('should demonstrate parameterized selectors and mixed patterns', () => {
    const createApp = (
      createStore: CreateStore<{
        products: {
          id: string;
          name: string;
          price: number;
          category: string;
        }[];
        taxRate: number;
        discount: number;
      }>
    ) => {
      const createSlice = createStore({
        products: [
          { id: '1', name: 'Laptop', price: 999, category: 'electronics' },
          { id: '2', name: 'Mouse', price: 29, category: 'electronics' },
          { id: '3', name: 'Desk', price: 299, category: 'furniture' },
          { id: '4', name: 'Chair', price: 199, category: 'furniture' },
        ],
        taxRate: 0.08,
        discount: 0.1,
      });

      // Product queries
      const products = createSlice(({ get }) => ({
        all: () => get().products,
        byId: (id: string) => get().products.find((p) => p.id === id),
        byCategory: (category: string) =>
          get().products.filter((p) => p.category === category),
      }));

      // Pricing calculations
      const pricing = createSlice(({ get }) => ({
        taxRate: () => get().taxRate,
        discount: () => get().discount,
        calculatePrice: (basePrice: number) => {
          const discounted = basePrice * (1 - get().discount);
          return discounted * (1 + get().taxRate);
        },
      }));

      // Create catalog views
      const catalog = createSlice(({ get }) => ({
        // Direct computed values
        totalProducts: () => get().products.length,
        categories: () => [...new Set(get().products.map((p) => p.category))],

        // Parameterized selector for product details
        getProductDetails: (id: string) => {
          const product = get().products.find((p) => p.id === id);
          if (!product) return null;

          const discount = get().discount;
          const taxRate = get().taxRate;
          const discountedPrice = product.price * (1 - discount);
          const finalPrice = discountedPrice * (1 + taxRate);

          return {
            ...product,
            finalPrice,
            savings: product.price * discount,
            tax: discountedPrice * taxRate,
          };
        },

        // Category summary factory
        getCategorySummary: (category: string) => {
          const items = get().products.filter((p) => p.category === category);
          const discount = get().discount;
          const taxRate = get().taxRate;

          const totalBase = items.reduce((sum, p) => sum + p.price, 0);
          const totalFinal = items.reduce((sum, p) => {
            const discounted = p.price * (1 - discount);
            return sum + discounted * (1 + taxRate);
          }, 0);

          return {
            category,
            itemCount: items.length,
            totalBasePrice: totalBase,
            totalFinalPrice: totalFinal,
            totalSavings: totalBase - totalFinal / (1 + taxRate),
          };
        },
      }));

      return { products, pricing, catalog };
    };

    const store = createZustandAdapter(createApp);

    // Test direct computed values
    expect(store.catalog.totalProducts()).toBe(4);
    expect(store.catalog.categories()).toEqual(['electronics', 'furniture']);

    // Test parameterized product details
    const laptop = store.catalog.getProductDetails('1');
    expect(laptop).not.toBeNull();
    expect(laptop!.name).toBe('Laptop');
    expect(laptop!.price).toBe(999);
    expect(laptop!.finalPrice).toBeCloseTo(971.03, 2); // (999 * 0.9) * 1.08
    expect(laptop!.savings).toBeCloseTo(99.9, 2);
    expect(laptop!.tax).toBeCloseTo(71.93, 2);

    // Test category summaries
    const electronics = store.catalog.getCategorySummary('electronics');
    expect(electronics.itemCount).toBe(2);
    expect(electronics.category).toBe('electronics');
    expect(electronics.totalBasePrice).toBe(1028);

    const furniture = store.catalog.getCategorySummary('furniture');
    expect(furniture.itemCount).toBe(2);
    expect(furniture.totalBasePrice).toBe(498);
  });

  it('should work with createZustandAdapter convenience function', () => {
    // Define a component factory directly
    const counterApp = (createStore: CreateStore<{ count: number }>) => {
      const createSlice = createStore({ count: 0 });

      const api = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
        double: () => set({ count: get().count * 2 }),
        reset: () => set({ count: 0 }),
      }));

      return api;
    };

    // Use the convenience function
    const store = createZustandAdapter(counterApp);

    // Test the API
    expect(store.count()).toBe(0);

    store.increment();
    expect(store.count()).toBe(1);

    store.double();
    expect(store.count()).toBe(2);

    store.double();
    expect(store.count()).toBe(4);

    store.decrement();
    expect(store.count()).toBe(3);

    store.reset();
    expect(store.count()).toBe(0);

    // Test subscriptions work
    const listener = vi.fn();
    const unsub = store.subscribe(listener);

    store.increment();
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
  });
});
