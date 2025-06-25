import { describe, it, expect, vi } from 'vitest';
import { create } from 'zustand';
import { createStore as createVanillaStore } from 'zustand/vanilla';
import type { RuntimeSliceFactory } from '@lattice/core';
import { zustandAdapter } from '.';

describe('Zustand Adapter - New Architecture', () => {
  it('should demonstrate basic store creation and slice patterns', () => {
    // Define a simple counter component using the signals-first API
    const createComponent = (
      createSlice: RuntimeSliceFactory<{ count: number }>
    ) => {
      // Actions slice - methods that mutate state
      const actions = createSlice(({ count }, set) => ({
        increment: () => set({ count: count() + 1 }),
        decrement: () => set({ count: count() - 1 }),
        reset: () => set({ count: 0 }),
        setCount: (value: number) => set({ count: value }),
      }));

      // Query slice - methods that read state
      const queries = createSlice(({ count }, _set) => ({
        count, // count is already a signal
        isPositive: () => count() > 0,
        isNegative: () => count() < 0,
        isZero: () => count() === 0,
      }));

      // View slices that compute values
      const views = createSlice(({ count }, _set) => ({
        // Direct computed values as methods
        computed: () => ({
          value: count(),
          label: `Count: ${count()}`,
          sign: count() > 0 ? 'positive' : count() < 0 ? 'negative' : 'zero',
        }),
        // Parameterized view
        display: (format: 'short' | 'long') => {
          const val = count();
          return format === 'short'
            ? `${val}`
            : `The current count is ${val} (${val > 0 ? 'positive' : val < 0 ? 'negative' : 'zero'})`;
        },
      }));

      return {
        actions,
        queries,
        views,
      };
    };

    // Create a Zustand store using native API
    const useStore = create<{ count: number }>(() => ({ count: 0 }));

    // Wrap it with the adapter
    const createSlice = zustandAdapter(useStore);
    const store = createComponent(createSlice);

    // Test initial state through queries
    expect(store.queries().count()).toBe(0);
    expect(store.queries().isZero()).toBe(true);
    expect(store.queries().isPositive()).toBe(false);
    expect(store.queries().isNegative()).toBe(false);

    // Test computed values (they're methods that return fresh data)
    const computed = store.views().computed();
    expect(computed.value).toBe(0);
    expect(computed.label).toBe('Count: 0');
    expect(computed.sign).toBe('zero');

    // Test parameterized views
    expect(store.views().display('short')).toBe('0');
    expect(store.views().display('long')).toBe('The current count is 0 (zero)');

    // Test actions
    store.actions().increment();
    expect(store.queries().count()).toBe(1);

    // Get fresh computed values
    const updated = store.views().computed();
    expect(updated.value).toBe(1);
    expect(updated.sign).toBe('positive');
    expect(store.views().display('short')).toBe('1');

    // Test multiple operations
    store.actions().increment();
    store.actions().increment();
    expect(store.queries().count()).toBe(3);

    store.actions().decrement();
    expect(store.queries().count()).toBe(2);

    store.actions().reset();
    expect(store.queries().count()).toBe(0);
    expect(store.queries().isZero()).toBe(true);

    store.actions().setCount(-5);
    expect(store.queries().count()).toBe(-5);
    expect(store.queries().isNegative()).toBe(true);
    expect(store.views().computed().sign).toBe('negative');
  });

  it('should support subscriptions and demonstrate reactivity', () => {
    const createComponent = (
      createSlice: RuntimeSliceFactory<{ value: number; history: number[] }>
    ) => {
      const actions = createSlice(({ value, history }, set) => ({
        setValue: (newValue: number) => {
          set({ 
            value: newValue,
            history: [...history(), newValue]
          });
        },
        increment: () => {
          const newValue = value() + 1;
          set({
            value: newValue,
            history: [...history(), newValue]
          });
        },
        reset: () => {
          set({
            value: 0,
            history: []
          });
        },
      }));

      const queries = createSlice(({ value, history }, _set) => ({
        value, // value is already a signal
        history, // history is already a signal
        current: () => value(),
        hasHistory: () => history().length > 0,
        lastValue: () => {
          const hist = history();
          return hist.length > 1 ? hist[hist.length - 2] : null;
        },
      }));

      return { actions, queries };
    };

    // Create vanilla Zustand store for easier testing
    const vanillaStore = createVanillaStore<{
      value: number;
      history: number[];
    }>(() => ({ value: 0, history: [] }));

    // Wrap with adapter
    const createSlice = zustandAdapter(vanillaStore);
    const store = createComponent(createSlice);

    // Track subscription calls
    const listener = vi.fn();
    const unsubscribe = store.queries().value.subscribe(listener);

    // Initial state
    expect(store.queries().current()).toBe(0);
    expect(store.queries().hasHistory()).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    // Update state
    store.actions().setValue(42);
    expect(store.queries().current()).toBe(42);
    expect(store.queries().history()).toEqual([42]);
    expect(listener).toHaveBeenCalledTimes(1);

    // Another update
    store.actions().increment();
    expect(store.queries().current()).toBe(43);
    expect(store.queries().history()).toEqual([42, 43]);
    expect(store.queries().lastValue()).toBe(42);
    expect(listener).toHaveBeenCalledTimes(2);

    // Multiple listeners
    const listener2 = vi.fn();
    const listener3 = vi.fn();
    const unsub2 = store.queries().value.subscribe(listener2);
    const unsub3 = store.queries().value.subscribe(listener3);

    store.actions().setValue(100);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener3).toHaveBeenCalledTimes(1);

    // Unsubscribe first listener
    unsubscribe();
    store.actions().reset();
    expect(listener).toHaveBeenCalledTimes(3); // No more calls
    expect(listener2).toHaveBeenCalledTimes(2);
    expect(listener3).toHaveBeenCalledTimes(2);

    // Cleanup
    unsub2();
    unsub3();
  });

  it('should demonstrate parameterized selectors and mixed patterns', () => {
    const createComponent = (
      createSlice: RuntimeSliceFactory<{
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
      // Product queries
      const products = createSlice(({ products }, _set) => ({
        all: () => products(),
        byId: (id: string) => products().find((p) => p.id === id),
        byCategory: (category: string) =>
          products().filter((p) => p.category === category),
      }));

      // Pricing calculations
      const pricing = createSlice(({ taxRate, discount }, _set) => ({
        taxRate, // taxRate is already a signal
        discount, // discount is already a signal
        calculatePrice: (basePrice: number) => {
          const discounted = basePrice * (1 - discount());
          return discounted * (1 + taxRate());
        },
      }));

      // Create catalog views
      const catalog = createSlice(({ products, taxRate, discount }, _set) => ({
        // Direct computed values
        totalProducts: () => products().length,
        categories: () => [...new Set(products().map((p) => p.category))],

        // Parameterized selector for product details
        getProductDetails: (id: string) => {
          const product = products().find((p) => p.id === id);
          if (!product) return null;

          const discountVal = discount();
          const taxRateVal = taxRate();
          const discountedPrice = product.price * (1 - discountVal);
          const finalPrice = discountedPrice * (1 + taxRateVal);

          return {
            ...product,
            finalPrice,
            savings: product.price * discountVal,
            tax: discountedPrice * taxRateVal,
          };
        },

        // Category summary factory
        getCategorySummary: (category: string) => {
          const items = products().filter((p) => p.category === category);
          const discountVal = discount();
          const taxRateVal = taxRate();

          const totalBase = items.reduce((sum, p) => sum + p.price, 0);
          const totalFinal = items.reduce((sum, p) => {
            const discounted = p.price * (1 - discountVal);
            return sum + discounted * (1 + taxRateVal);
          }, 0);

          return {
            category,
            itemCount: items.length,
            totalBasePrice: totalBase,
            totalFinalPrice: totalFinal,
            totalSavings: totalBase - totalFinal / (1 + taxRateVal),
          };
        },
      }));

      return { products, pricing, catalog };
    };

    // Create Zustand store with initial data
    const useStore = create<{
      products: {
        id: string;
        name: string;
        price: number;
        category: string;
      }[];
      taxRate: number;
      discount: number;
    }>(() => ({
      products: [
        { id: '1', name: 'Laptop', price: 999, category: 'electronics' },
        { id: '2', name: 'Mouse', price: 29, category: 'electronics' },
        { id: '3', name: 'Desk', price: 299, category: 'furniture' },
        { id: '4', name: 'Chair', price: 199, category: 'furniture' },
      ],
      taxRate: 0.08,
      discount: 0.1,
    }));

    // Wrap with adapter
    const createSlice = zustandAdapter(useStore);
    const store = createComponent(createSlice);

    // Test direct computed values
    expect(store.catalog().totalProducts()).toBe(4);
    expect(store.catalog().categories()).toEqual(['electronics', 'furniture']);

    // Test parameterized product details
    const laptop = store.catalog().getProductDetails('1');
    expect(laptop).not.toBeNull();
    expect(laptop!.name).toBe('Laptop');
    expect(laptop!.price).toBe(999);
    expect(laptop!.finalPrice).toBeCloseTo(971.03, 2); // (999 * 0.9) * 1.08
    expect(laptop!.savings).toBeCloseTo(99.9, 2);
    expect(laptop!.tax).toBeCloseTo(71.93, 2);

    // Test category summaries
    const electronics = store.catalog().getCategorySummary('electronics');
    expect(electronics.itemCount).toBe(2);
    expect(electronics.category).toBe('electronics');
    expect(electronics.totalBasePrice).toBe(1028);

    const furniture = store.catalog().getCategorySummary('furniture');
    expect(furniture.itemCount).toBe(2);
    expect(furniture.totalBasePrice).toBe(498);
  });

  it('should work with Zustand middleware (persist, devtools, etc)', () => {
    // Example showing how existing Zustand stores with middleware work
    interface State {
      count: number;
      lastAction: string;
    }

    // Simulate a store with devtools middleware (common pattern)
    const useStore = create<State>()(() => ({
      count: 0,
      lastAction: 'init',
      // Note: In real usage, these actions would also work through Lattice
    }));

    // Create component with the adapter
    const createComponent = (createSlice: RuntimeSliceFactory<State>) => {
      const actions = createSlice(({ count }, set) => ({
        increment: () => {
          set({
            count: count() + 1,
            lastAction: 'increment'
          });
        },
        decrement: () => {
          set({
            count: count() - 1,
            lastAction: 'decrement'
          });
        },
      }));

      const queries = createSlice(({ count, lastAction }, _set) => ({
        state: () => ({ count: count(), lastAction: lastAction() }),
        count, // count is already a signal
        lastAction, // lastAction is already a signal
      }));

      return { actions, queries };
    };

    // Wrap store with adapter - middleware continues to work
    const createSlice = zustandAdapter(useStore);
    const store = createComponent(createSlice);

    // Test basic functionality (middleware like devtools would see these)
    expect(store.queries().count()).toBe(0);
    expect(store.queries().lastAction()).toBe('init');

    store.actions().increment();
    expect(store.queries().count()).toBe(1);
    expect(store.queries().lastAction()).toBe('increment');

    store.actions().decrement();
    expect(store.queries().count()).toBe(0);
    expect(store.queries().lastAction()).toBe('decrement');

    // The key point: all Zustand middleware (persist, devtools, immer, etc)
    // continues to work because we're just wrapping the store, not replacing it
  });

  it('should demonstrate real-world usage with existing Zustand store', () => {
    // Simulate an existing Zustand store that a user might have
    interface UserState {
      user: { id: string; name: string } | null;
      isAuthenticated: boolean;
      login: (id: string, name: string) => void;
      logout: () => void;
    }

    // User's existing Zustand store with actions
    const useAuthStore = create<UserState>((set) => ({
      user: null,
      isAuthenticated: false,
      login: (id: string, name: string) =>
        set({
          user: { id, name },
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
        }),
    }));

    // Now they want to use it with Lattice components
    const createAuthComponent = (
      createSlice: RuntimeSliceFactory<UserState>
    ) => {
      // Create queries slice
      const auth = createSlice(({ user, isAuthenticated, login, logout }, _set) => ({
        // Expose queries
        user, // user is already a signal
        isAuthenticated, // isAuthenticated is already a signal
        userName: () => user()?.name ?? 'Guest',

        // Can also expose the store's actions if needed
        login: () => login(),
        logout: () => logout(),
      }));

      // Or create new Lattice-style actions
      const actions = createSlice(({ user }, set) => ({
        updateUserName: (name: string) => {
          const currentUser = user();
          if (currentUser) {
            set({ user: { ...currentUser, name } });
          }
        },
      }));

      return { auth, actions };
    };

    // Wrap the existing store
    const createSlice = zustandAdapter(useAuthStore);
    const component = createAuthComponent(createSlice);

    // Test using both store methods and Lattice methods
    expect(component.auth().isAuthenticated()).toBe(false);
    expect(component.auth().userName()).toBe('Guest');

    // Use the original store's action through Lattice
    const login = component.auth().login();
    login('123', 'John Doe');

    expect(component.auth().isAuthenticated()).toBe(true);
    expect(component.auth().userName()).toBe('John Doe');

    // Use Lattice-style action
    component.actions().updateUserName('Jane Doe');
    expect(component.auth().userName()).toBe('Jane Doe');

    // Original store action still works
    const logout = component.auth().logout();
    logout();
    expect(component.auth().isAuthenticated()).toBe(false);
  });
});
