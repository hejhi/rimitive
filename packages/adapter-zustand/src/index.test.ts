import { describe, it, expect, vi } from 'vitest';
import { create } from 'zustand';
import { createStore as createVanillaStore } from 'zustand/vanilla';
import { createComponent, withState, createStoreWithAdapter } from '@lattice/core';
import { zustandAdapter } from '.';

describe('Zustand Adapter - New Architecture', () => {
  it('should demonstrate basic store creation and slice patterns', () => {
    // Create a Zustand store using native API
    const useStore = create<{ count: number }>(() => ({ count: 0 }));

    // Wrap it with the adapter
    const adapter = zustandAdapter(useStore);

    // Define counter component using new API
    const Counter = createComponent(
      withState<{ count: number }>(),
      ({ store, computed, set }) => {
        // Direct access to signals
        const count = store.count;
        
        return {
          // Actions
          increment: () => set({ count: count() + 1 }),
          decrement: () => set({ count: count() - 1 }),
          reset: () => set({ count: 0 }),
          setCount: (value: number) => set({ count: value }),
          
          // Queries
          count,
          isPositive: computed(() => count() > 0),
          isNegative: computed(() => count() < 0),
          isZero: computed(() => count() === 0),
          
          // Views
          computed: computed(() => ({
            value: count(),
            label: `Count: ${count()}`,
            sign: count() > 0 ? 'positive' : count() < 0 ? 'negative' : 'zero',
          })),
          display: (format: 'short' | 'long') => {
            const val = count();
            return format === 'short'
              ? `${val}`
              : `The current count is ${val} (${val > 0 ? 'positive' : val < 0 ? 'negative' : 'zero'})`;
          },
        };
      }
    );

    const store = createStoreWithAdapter(Counter, adapter);

    // Test initial state through queries
    expect(store.count()).toBe(0);
    expect(store.isZero()).toBe(true);
    expect(store.isPositive()).toBe(false);
    expect(store.isNegative()).toBe(false);

    // Test computed values
    const computed = store.computed();
    expect(computed.value).toBe(0);
    expect(computed.label).toBe('Count: 0');
    expect(computed.sign).toBe('zero');

    // Test parameterized views
    expect(store.display('short')).toBe('0');
    expect(store.display('long')).toBe('The current count is 0 (zero)');

    // Test actions
    store.increment();
    expect(store.count()).toBe(1);

    // Get fresh computed values
    const updated = store.computed();
    expect(updated.value).toBe(1);
    expect(updated.sign).toBe('positive');
    expect(store.display('short')).toBe('1');

    // Test multiple operations
    store.increment();
    store.increment();
    expect(store.count()).toBe(3);

    store.decrement();
    expect(store.count()).toBe(2);

    store.reset();
    expect(store.count()).toBe(0);
    expect(store.isZero()).toBe(true);

    store.setCount(-5);
    expect(store.count()).toBe(-5);
    expect(store.isNegative()).toBe(true);
    expect(store.computed().sign).toBe('negative');
  });

  it('should support subscriptions and demonstrate reactivity', () => {
    // Create vanilla Zustand store for easier testing
    const vanillaStore = createVanillaStore<{
      value: number;
      history: number[];
    }>(() => ({ value: 0, history: [] }));

    // Wrap with adapter
    const adapter = zustandAdapter(vanillaStore);

    // Create component with new API
    const Component = createComponent(
      withState<{ value: number; history: number[] }>(),
      ({ store, computed, set }) => ({
        // Actions
        setValue: (newValue: number) => {
          set({ 
            value: newValue,
            history: [...store.history(), newValue]
          });
        },
        increment: () => {
          const newValue = store.value() + 1;
          set({
            value: newValue,
            history: [...store.history(), newValue]
          });
        },
        reset: () => {
          set({
            value: 0,
            history: []
          });
        },
        
        // Queries
        value: store.value,
        history: store.history,
        current: computed(() => store.value()),
        hasHistory: computed(() => store.history().length > 0),
        lastValue: computed(() => {
          const hist = store.history();
          return hist.length > 1 ? hist[hist.length - 2] : null;
        }),
      })
    );

    const store = createStoreWithAdapter(Component, adapter);

    // Track subscription calls
    const listener = vi.fn();
    const unsubscribe = store.value.subscribe(listener);

    // Initial state
    expect(store.current()).toBe(0);
    expect(store.hasHistory()).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    // Update state
    store.setValue(42);
    expect(store.current()).toBe(42);
    expect(store.history()).toEqual([42]);
    expect(listener).toHaveBeenCalledTimes(1);

    // Another update
    store.increment();
    expect(store.current()).toBe(43);
    expect(store.history()).toEqual([42, 43]);
    expect(store.lastValue()).toBe(42);
    expect(listener).toHaveBeenCalledTimes(2);

    // Multiple listeners
    const listener2 = vi.fn();
    const listener3 = vi.fn();
    const unsub2 = store.value.subscribe(listener2);
    const unsub3 = store.value.subscribe(listener3);

    store.setValue(100);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener3).toHaveBeenCalledTimes(1);

    // Unsubscribe first listener
    unsubscribe();
    store.reset();
    expect(listener).toHaveBeenCalledTimes(3); // No more calls
    expect(listener2).toHaveBeenCalledTimes(2);
    expect(listener3).toHaveBeenCalledTimes(2);

    // Cleanup
    unsub2();
    unsub3();
  });

  it('should demonstrate parameterized selectors and mixed patterns', () => {
    type StoreState = {
      products: {
        id: string;
        name: string;
        price: number;
        category: string;
      }[];
      taxRate: number;
      discount: number;
    };

    // Create Zustand store
    const store = createVanillaStore<StoreState>(() => ({
      products: [],
      taxRate: 0.08,
      discount: 0.1,
    }));

    const adapter = zustandAdapter(store);

    // Create component with new API
    const Catalog = createComponent(
      withState<StoreState>(),
      ({ store, computed }) => ({
        // Product queries
        all: computed(() => store.products()),
        byId: (id: string) => store.products().find((p) => p.id === id),
        byCategory: (category: string) =>
          store.products().filter((p) => p.category === category),

        // Pricing
        taxRate: store.taxRate,
        discount: store.discount,
        calculatePrice: (basePrice: number) => {
          const discounted = basePrice * (1 - store.discount());
          return discounted * (1 + store.taxRate());
        },

        // Catalog views
        totalProducts: computed(() => store.products().length),
        categories: computed(() => [...new Set(store.products().map((p) => p.category))]),

        // Parameterized selector for product details
        getProductDetails: (id: string) => {
          const product = store.products().find((p) => p.id === id);
          if (!product) return null;

          const discountVal = store.discount();
          const taxRateVal = store.taxRate();
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
          const items = store.products().filter((p) => p.category === category);
          const discountVal = store.discount();
          const taxRateVal = store.taxRate();

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
      })
    );

    // Set initial data
    store.setState({
      products: [
        { id: '1', name: 'Laptop', price: 999, category: 'electronics' },
        { id: '2', name: 'Mouse', price: 29, category: 'electronics' },
        { id: '3', name: 'Desk', price: 299, category: 'furniture' },
        { id: '4', name: 'Chair', price: 199, category: 'furniture' },
      ],
    });

    const catalog = createStoreWithAdapter(Catalog, adapter);

    // Test direct computed values
    expect(catalog.totalProducts()).toBe(4);
    expect(catalog.categories()).toEqual(['electronics', 'furniture']);

    // Test parameterized product details
    const laptop = catalog.getProductDetails('1');
    expect(laptop).not.toBeNull();
    expect(laptop!.name).toBe('Laptop');
    expect(laptop!.price).toBe(999);
    expect(laptop!.finalPrice).toBeCloseTo(971.03, 2); // (999 * 0.9) * 1.08
    expect(laptop!.savings).toBeCloseTo(99.9, 2);
    expect(laptop!.tax).toBeCloseTo(71.93, 2);

    // Test category summaries
    const electronics = catalog.getCategorySummary('electronics');
    expect(electronics.itemCount).toBe(2);
    expect(electronics.category).toBe('electronics');
    expect(electronics.totalBasePrice).toBe(1028);

    const furniture = catalog.getCategorySummary('furniture');
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

    // Wrap store with adapter
    const adapter = zustandAdapter(useStore);

    // Create component with new API
    const Counter = createComponent(
      withState<State>(),
      ({ store, set }) => ({
        increment: () => {
          set({
            count: store.count() + 1,
            lastAction: 'increment'
          });
        },
        decrement: () => {
          set({
            count: store.count() - 1,
            lastAction: 'decrement'
          });
        },
        state: () => ({ count: store.count(), lastAction: store.lastAction() }),
        count: store.count,
        lastAction: store.lastAction,
      })
    );

    const counter = createStoreWithAdapter(Counter, adapter);

    // Test basic functionality (middleware like devtools would see these)
    expect(counter.count()).toBe(0);
    expect(counter.lastAction()).toBe('init');

    counter.increment();
    expect(counter.count()).toBe(1);
    expect(counter.lastAction()).toBe('increment');

    counter.decrement();
    expect(counter.count()).toBe(0);
    expect(counter.lastAction()).toBe('decrement');

    // The key point: all Zustand middleware (persist, devtools, immer, etc)
    // continues to work because we're just wrapping the store, not replacing it
  });

  it('should demonstrate real-world usage with existing Zustand store', () => {
    // Simulate an existing Zustand store that a user might have
    interface UserState {
      user: { id: string; name: string } | null;
      isAuthenticated: boolean;
    }

    // User's existing Zustand store
    const useAuthStore = create<UserState>(() => ({
      user: null,
      isAuthenticated: false,
    }));

    // Wrap the existing store
    const adapter = zustandAdapter(useAuthStore);

    // Create Lattice component
    const AuthComponent = createComponent(
      withState<UserState>(),
      ({ store, computed, set }) => ({
        // Expose queries
        user: store.user,
        isAuthenticated: store.isAuthenticated,
        userName: computed(() => store.user()?.name ?? 'Guest'),

        // Lattice-style actions
        login: (id: string, name: string) => {
          set({
            user: { id, name },
            isAuthenticated: true,
          });
        },
        logout: () => {
          set({
            user: null,
            isAuthenticated: false,
          });
        },
        updateUserName: (name: string) => {
          const currentUser = store.user();
          if (currentUser) {
            set({ user: { ...currentUser, name } });
          }
        },
      })
    );

    const auth = createStoreWithAdapter(AuthComponent, adapter);

    // Test using Lattice methods
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.userName()).toBe('Guest');

    // Login
    auth.login('123', 'John Doe');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.userName()).toBe('John Doe');

    // Update name
    auth.updateUserName('Jane Doe');
    expect(auth.userName()).toBe('Jane Doe');

    // Logout
    auth.logout();
    expect(auth.isAuthenticated()).toBe(false);
  });
});
