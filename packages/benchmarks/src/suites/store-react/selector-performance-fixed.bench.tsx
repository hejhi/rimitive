/**
 * @fileoverview Fixed selector performance benchmark for @lattice/store-react
 * 
 * This properly isolates selector execution performance from React rendering overhead
 */

import { describe, bench, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStore, type StoreApi } from '@lattice/store/react';

describe('Selector Performance - Properly Isolated', () => {
  type ComplexState = {
    users: Record<string, { id: string; name: string; age: number; active: boolean }>;
    products: Array<{ id: string; name: string; price: number; category: string }>;
    settings: {
      theme: 'light' | 'dark';
      language: string;
      notifications: { email: boolean; push: boolean; sms: boolean };
    };
    stats: {
      totalUsers: number;
      activeUsers: number;
      totalRevenue: number;
      averageOrderValue: number;
    };
    updateUser: (id: string, updates: Partial<ComplexState['users'][string]>) => void;
    updateSetting: (path: string, value: any) => void;
  };

  // Setup data outside benchmarks
  const createInitialState = () => {
    const users: ComplexState['users'] = {};
    for (let i = 0; i < 1000; i++) {
      users[`user-${i}`] = {
        id: `user-${i}`,
        name: `User ${i}`,
        age: 20 + (i % 50),
        active: i % 3 !== 0,
      };
    }

    const products: ComplexState['products'] = Array.from(
      { length: 500 },
      (_, i) => ({
        id: `product-${i}`,
        name: `Product ${i}`,
        price: Math.random() * 1000,
        category: ['electronics', 'clothing', 'food', 'books'][i % 4] || 'electronics',
      })
    );

    return { users, products };
  };

  // Define selectors outside benchmarks
  const simpleSelector = (state: ComplexState) => state.settings.theme;
  
  const complexSelector = (state: ComplexState) => 
    Object.values(state.users).filter(u => u.active && u.age > 30).length;
  
  const multiFieldSelector = (state: ComplexState) => ({
    theme: state.settings.theme,
    activeCount: state.stats.activeUsers,
    expensiveProducts: state.products.filter(p => p.price > 500).length,
  });

  describe('Pure Selector Execution (no React)', () => {
    let storeState: ComplexState;
    
    beforeEach(() => {
      const { users, products } = createInitialState();
      
      // Create a plain state object for pure selector testing
      storeState = {
        users,
        products,
        settings: {
          theme: 'light',
          language: 'en',
          notifications: { email: true, push: false, sms: false },
        },
        stats: {
          totalUsers: Object.keys(users).length,
          activeUsers: Object.values(users).filter(u => u.active).length,
          totalRevenue: 0,
          averageOrderValue: 0,
        },
        updateUser: () => {},
        updateSetting: () => {},
      };
    });

    bench('simple selector - direct execution', () => {
      // Measure ONLY selector execution
      const result = simpleSelector(storeState);
      // Use result to prevent optimization
      if (result !== 'light' && result !== 'dark') throw new Error('Unexpected result');
    });

    bench('complex selector - direct execution', () => {
      // Measure ONLY selector execution with expensive computation
      const result = complexSelector(storeState);
      // Use result to prevent optimization
      if (typeof result !== 'number') throw new Error('Unexpected result');
    });

    bench('multi-field selector - direct execution', () => {
      // Measure ONLY selector execution accessing multiple fields
      const result = multiFieldSelector(storeState);
      // Use result to prevent optimization
      if (!result.theme || typeof result.activeCount !== 'number') {
        throw new Error('Unexpected result');
      }
    });
  });

  describe('Selector with Store Integration (minimal React)', () => {
    let store: ComplexState & StoreApi<ComplexState>;
    
    beforeEach(() => {
      // Setup store ONCE before benchmarks
      const { users, products } = createInitialState();
      
      const { result } = renderHook(() =>
        useStore<ComplexState>((set, get) => ({
          users,
          products,
          settings: {
            theme: 'light',
            language: 'en',
            notifications: { email: true, push: false, sms: false },
          },
          stats: {
            totalUsers: Object.keys(users).length,
            activeUsers: Object.values(users).filter(u => u.active).length,
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
          updateSetting: (path, value) => {
            set({
              settings: {
                ...get().settings,
                theme: path === 'theme' ? value : get().settings.theme,
              },
            });
          },
        }))
      );
      
      store = result.current;
    });

    bench('selector on store state - no subscription', () => {
      // Get current state snapshot
      const state = store.getState();
      
      // Measure ONLY selector execution on snapshot
      const result = complexSelector(state);
      
      // Use result to prevent optimization
      if (typeof result !== 'number') throw new Error('Unexpected result');
    });

    bench('multiple selector executions - cache behavior', () => {
      const state = store.getState();
      
      // Execute selector multiple times on same state
      // This tests if selector results are cached/memoized
      for (let i = 0; i < 100; i++) {
        const result = complexSelector(state);
        if (typeof result !== 'number') throw new Error('Unexpected result');
      }
    });

    bench('selector execution after state change', () => {
      // Get initial state and result
      let state = store.getState();
      const initialResult = complexSelector(state);
      
      // Change state
      store.updateUser('user-0', { active: true, age: 35 });
      
      // Get new state and measure selector on changed state
      state = store.getState();
      const newResult = complexSelector(state);
      
      // Verify result changed
      if (newResult === initialResult) {
        throw new Error('Result should have changed');
      }
    });
  });

  describe('Selector Equality Checking', () => {
    let store: ComplexState & StoreApi<ComplexState>;
    
    beforeEach(() => {
      const { users, products } = createInitialState();
      
      const { result } = renderHook(() =>
        useStore<ComplexState>((set, get) => ({
          users,
          products,
          settings: {
            theme: 'light',
            language: 'en',
            notifications: { email: true, push: false, sms: false },
          },
          stats: {
            totalUsers: Object.keys(users).length,
            activeUsers: Object.values(users).filter(u => u.active).length,
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
          updateSetting: (path, value) => {
            set({
              settings: {
                ...get().settings,
                theme: path === 'theme' ? value : get().settings.theme,
              },
            });
          },
        }))
      );
      
      store = result.current;
    });

    bench('selector stability - unchanged state', () => {
      const state1 = store.getState();
      const result1 = simpleSelector(state1);
      
      // No state change, get state again
      const state2 = store.getState();
      const result2 = simpleSelector(state2);
      
      // Results should be identical (same reference for primitives)
      if (!Object.is(result1, result2)) {
        throw new Error('Results should be identical');
      }
    });

    bench('selector recomputation - relevant change', () => {
      const state1 = store.getState();
      const result1 = simpleSelector(state1);
      
      // Change relevant state
      store.updateSetting('theme', 'dark');
      
      const state2 = store.getState();
      const result2 = simpleSelector(state2);
      
      // Results should be different
      if (Object.is(result1, result2)) {
        throw new Error('Results should be different');
      }
    });

    bench('selector stability - irrelevant change', () => {
      const state1 = store.getState();
      const result1 = simpleSelector(state1);
      
      // Change irrelevant state
      store.updateUser('user-0', { name: 'Changed Name' });
      
      const state2 = store.getState();
      const result2 = simpleSelector(state2);
      
      // Results should be identical (selector doesn't depend on users)
      if (!Object.is(result1, result2)) {
        throw new Error('Results should be identical for irrelevant changes');
      }
    });
  });
});