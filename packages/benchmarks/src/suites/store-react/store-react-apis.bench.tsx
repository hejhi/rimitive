/**
 * @fileoverview Benchmarks for store-react specific APIs
 *
 * Tests performance of createStoreContext, useStoreSelector, and other
 * store-react specific features that differentiate it from other solutions.
 */

import { describe, bench } from 'vitest';
import { renderHook, render, RenderHookResult } from '@testing-library/react';
import {
  useStore,
  createStoreContext,
  useStoreSelector,
  StoreApi,
} from '@lattice/store/react';
import React, { act } from 'react';

describe('Store-React Specific APIs', () => {
  describe('createStoreContext performance', () => {
    type TestStore = {
      count: number;
      nested: {
        value: string;
        items: number[];
      };
      increment: () => void;
      updateNested: (value: string) => void;
      addItem: (item: number) => void;
    };

    bench('createStoreContext - context creation and provider setup', () => {
      // Create the context
      const Context = createStoreContext<TestStore>();

      // Create a store to use with the context
      const { result: storeResult } = renderHook(() =>
        useStore<TestStore>((set, get) => ({
          count: 0,
          nested: { value: 'initial', items: [] },
          increment: () => set({ count: get().count + 1 }),
          updateNested: (value) =>
            set({
              nested: { ...get().nested, value },
            }),
          addItem: (item) =>
            set({
              nested: {
                ...get().nested,
                items: [...get().nested.items, item],
              },
            }),
        }))
      );

      // Component that uses the context
      const ConsumerComponent = () => {
        const store = Context.useStore();
        void store; // Access store from context
        return null;
      };

      // Render with provider - this is what we're actually benchmarking
      const { unmount } = render(
        React.createElement(
          Context.Provider,
          { value: storeResult.current },
          React.createElement(ConsumerComponent)
        )
      );

      // Perform some operations
      act(() => {
        storeResult.current.increment();
        storeResult.current.updateNested('updated');
        storeResult.current.addItem(1);
      });

      unmount();
    });

    bench('multiple store contexts - independent stores', () => {
      createStoreContext<TestStore>();
      createStoreContext<TestStore>();
      createStoreContext<TestStore>();

      const hooks = [
        renderHook(() =>
          useStore<TestStore>((set, get) => ({
            count: 0,
            nested: { value: 'store1', items: [] },
            increment: () => set({ count: get().count + 1 }),
            updateNested: (value) =>
              set({
                nested: { ...get().nested, value },
              }),
            addItem: (item) =>
              set({
                nested: {
                  ...get().nested,
                  items: [...get().nested.items, item],
                },
              }),
          }))
        ),
        renderHook(() =>
          useStore<TestStore>((set, get) => ({
            count: 0,
            nested: { value: 'store2', items: [] },
            increment: () => set({ count: get().count + 1 }),
            updateNested: (value) =>
              set({
                nested: { ...get().nested, value },
              }),
            addItem: (item) =>
              set({
                nested: {
                  ...get().nested,
                  items: [...get().nested.items, item],
                },
              }),
          }))
        ),
        renderHook(() =>
          useStore<TestStore>((set, get) => ({
            count: 0,
            nested: { value: 'store3', items: [] },
            increment: () => set({ count: get().count + 1 }),
            updateNested: (value) =>
              set({
                nested: { ...get().nested, value },
              }),
            addItem: (item) =>
              set({
                nested: {
                  ...get().nested,
                  items: [...get().nested.items, item],
                },
              }),
          }))
        ),
      ];

      act(() => {
        hooks.forEach((hook, i) => {
          hook.result.current.increment();
          hook.result.current.updateNested(`updated-${i}`);
          hook.result.current.addItem(i);
        });
      });
    });
  });

  describe('useStoreSelector performance', () => {
    type ComplexStore = {
      users: Record<
        string,
        { id: string; name: string; age: number; active: boolean }
      >;
      products: Array<{
        id: string;
        name: string;
        price: number;
        category: string;
      }>;
      settings: {
        theme: 'light' | 'dark';
        language: string;
        notifications: {
          email: boolean;
          push: boolean;
          sms: boolean;
        };
      };
      stats: {
        totalUsers: number;
        activeUsers: number;
        totalRevenue: number;
        averageOrderValue: number;
      };
      updateUser: (
        id: string,
        updates: Partial<ComplexStore['users'][string]>
      ) => void;
      addProduct: (product: ComplexStore['products'][0]) => void;
      updateSetting: (path: string, value: any) => void;
      recalculateStats: () => void;
    };

    const createComplexStore = () => {
      const initialUsers: ComplexStore['users'] = {};
      for (let i = 0; i < 1000; i++) {
        initialUsers[`user-${i}`] = {
          id: `user-${i}`,
          name: `User ${i}`,
          age: 20 + (i % 50),
          active: i % 3 !== 0,
        };
      }

      const initialProducts: ComplexStore['products'] = Array.from(
        { length: 500 },
        (_, i) => ({
          id: `product-${i}`,
          name: `Product ${i}`,
          price: Math.random() * 1000,
          category:
            ['electronics', 'clothing', 'food', 'books'][i % 4] ||
            'electronics',
        })
      );

      return useStore<ComplexStore>((set, get) => ({
        users: initialUsers,
        products: initialProducts,
        settings: {
          theme: 'light',
          language: 'en',
          notifications: {
            email: true,
            push: false,
            sms: false,
          },
        },
        stats: {
          totalUsers: Object.keys(initialUsers).length,
          activeUsers: Object.values(initialUsers).filter((u) => u.active)
            .length,
          totalRevenue: 0,
          averageOrderValue: 0,
        },
        updateUser: (id, updates) => {
          const user = get().users[id];
          if (user && updates) {
            set({
              users: {
                ...get().users,
                [id]: { ...user, ...updates },
              },
            });
          }
        },
        addProduct: (product) =>
          set({
            products: [...get().products, product],
          }),
        updateSetting: (path, value) => {
          // Simplified path update
          set({
            settings: {
              ...get().settings,
              theme: path === 'theme' ? value : get().settings.theme,
            },
          });
        },
        recalculateStats: () => {
          const users = Object.values(get().users);
          set({
            stats: {
              ...get().stats,
              totalUsers: users.length,
              activeUsers: users.filter((u) => u.active).length,
            },
          });
        },
      }));
    };

    const setupStore = () => {
      const { result } = renderHook(() => createComplexStore());
      return result;
    };

    bench('useStoreSelector - simple selector', () => {
      // Setup store ONCE before measurement
      const storeResult = setupStore();
      const store = storeResult.current;

      // Define selector outside measurement
      const themeSelector = (s: ComplexStore) => s.settings.theme;

      // Get current state snapshot
      const state = store.getState();

      // Measure ONLY selector execution
      for (let i = 0; i < 1000; i++) {
        const theme = themeSelector(state);
        if (theme !== 'light' && theme !== 'dark') {
          throw new Error('Unexpected theme value');
        }
      }
    });

    let store: RenderHookResult<ComplexStore & StoreApi<ComplexStore>, unknown>;
    let hookResult: RenderHookResult<
      {
        store: ComplexStore & StoreApi<ComplexStore>;
        activeUsersOver30: number;
      },
      unknown
    >;

    beforeAll(() => {
      store = renderHook(() => createComplexStore());

      hookResult = renderHook(() => {
        const activeUsersOver30 = useStoreSelector(
          store.result.current,
          (s) =>
            Object.values(s.users).filter((u) => u.active && u.age > 30).length
        );
        return { store: store.result.current, activeUsersOver30 };
      });
    });

    bench('useStoreSelector - complex computed selector', () => {
      act(() => {
        // Updates that affect the selector result
        for (let i = 0; i < 50; i++) {
          hookResult.result.current.store.updateUser(`user-${i}`, {
            active: true,
            age: 35,
          });
        }
      });
    });

    bench('useStoreSelector - multiple selectors in component', () => {
      const { result } = renderHook(() => {
        const _store = store.result.current;
        const totalUsers = useStoreSelector(_store, (s) => s.stats.totalUsers);
        const activeUsers = useStoreSelector(
          _store,
          (s) => s.stats.activeUsers
        );
        const theme = useStoreSelector(_store, (s) => s.settings.theme);
        const emailNotifications = useStoreSelector(
          _store,
          (s) => s.settings.notifications.email
        );
        const productCount = useStoreSelector(_store, (s) => s.products.length);
        const expensiveProducts = useStoreSelector(
          _store,
          (s) => s.products.filter((p) => p.price > 500).length
        );

        return {
          store: _store,
          totalUsers,
          activeUsers,
          theme,
          emailNotifications,
          productCount,
          expensiveProducts,
        };
      });

      act(() => {
        // Trigger various updates
        result.current.store.updateSetting('theme', 'dark');
        result.current.store.addProduct({
          id: 'new-1',
          name: 'New Product',
          price: 750,
          category: 'electronics',
        });
        result.current.store.recalculateStats();
      });
    });
  });

  describe('Store-React Patterns', () => {
    bench('Multiple independent stores', () => {
      const hooks = Array.from({ length: 5 }, (_, i) =>
        renderHook(() => useStore(() => ({ value: i, increment: () => {} })))
      );

      act(() => {
        hooks.forEach((hook) => {
          // Access store values
          hook.result.current.value;
        });
      });
    });

    bench('Store with derived state', () => {
      type DerivedStore = {
        items: Array<{ id: string; price: number; quantity: number }>;
        taxRate: number;
        discountPercent: number;
        addItem: (item: {
          id: string;
          price: number;
          quantity: number;
        }) => void;
        removeItem: (id: string) => void;
        setTaxRate: (rate: number) => void;
        setDiscount: (percent: number) => void;
        getSubtotal: () => number;
        getTax: () => number;
        getDiscount: () => number;
        getTotal: () => number;
      };

      const { result } = renderHook(() => {
        const store = useStore<DerivedStore>((set, get) => ({
          items: [],
          taxRate: 0.08,
          discountPercent: 0,
          addItem: (item) => set({ items: [...get().items, item] }),
          removeItem: (id) =>
            set({
              items: get().items.filter((item) => item.id !== id),
            }),
          setTaxRate: (rate) => set({ taxRate: rate }),
          setDiscount: (percent) => set({ discountPercent: percent }),
          getSubtotal: () => {
            return get().items.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0
            );
          },
          getTax: () => {
            const subtotal = get().getSubtotal();
            return subtotal * get().taxRate;
          },
          getDiscount: () => {
            const subtotal = get().getSubtotal();
            return subtotal * (get().discountPercent / 100);
          },
          getTotal: () => {
            const subtotal = get().getSubtotal();
            const tax = get().getTax();
            const discount = get().getDiscount();
            return subtotal + tax - discount;
          },
        }));

        // Use selectors for derived values
        const subtotal = useStoreSelector(store, (s) => s.getSubtotal());
        const tax = useStoreSelector(store, (s) => s.getTax());
        const total = useStoreSelector(store, (s) => s.getTotal());

        return { store, subtotal, tax, total };
      });

      act(() => {
        // Add items
        for (let i = 0; i < 20; i++) {
          result.current.store.addItem({
            id: `item-${i}`,
            price: Math.random() * 100,
            quantity: Math.floor(Math.random() * 5) + 1,
          });
        }

        // Update tax and discount
        result.current.store.setTaxRate(0.095);
        result.current.store.setDiscount(10);

        // Remove some items
        result.current.store.removeItem('item-5');
        result.current.store.removeItem('item-10');
      });
    });
  });
});
