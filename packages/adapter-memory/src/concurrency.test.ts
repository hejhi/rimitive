import { describe, it, expect } from 'vitest';
import { createMemoryAdapter } from './index';
import { createModel, createSlice, createComponent, select } from '@lattice/core';

describe('Memory Adapter - Concurrent Updates and Race Conditions', () => {
  /**
   * Tests for handling concurrent state updates and preventing race conditions
   */
  describe('concurrent state updates', () => {
    it('should handle rapid sequential updates correctly', () => {
      const component = createComponent(() => {
        const model = createModel<{
          counter: number;
          incrementBy: (amount: number) => void;
        }>(({ get, set }) => ({
          counter: 0,
          incrementBy: (amount: number) => {
            const current = get().counter;
            set({ counter: current + amount });
          }
        }));
        
        return {
          model,
          actions: createSlice(model, m => ({ incrementBy: m.incrementBy })),
          views: {
            count: createSlice(model, m => ({ value: m.counter }))
          }
        };
      });
      
      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);
      
      // Perform rapid updates
      for (let i = 1; i <= 10; i++) {
        result.actions.get().incrementBy(i);
      }
      
      // Sum of 1+2+3+...+10 = 55
      expect(result.model.get().counter).toBe(55);
      expect(result.views.count.get().value).toBe(55);
    });

    it('should handle concurrent slice subscriptions during updates', () => {
      const component = createComponent(() => {
        const model = createModel<{
          value: number;
          update: (val: number) => void;
        }>(({ set }) => ({
          value: 0,
          update: (val: number) => set({ value: val })
        }));
        
        const valueSlice = createSlice(model, m => ({ val: m.value }));
        const doubledSlice = createSlice(model, m => ({ doubled: m.value * 2 }));
        const squaredSlice = createSlice(model, m => ({ squared: m.value * m.value }));
        
        return {
          model,
          actions: createSlice(model, m => ({ update: m.update })),
          views: {
            value: valueSlice,
            doubled: doubledSlice,
            squared: squaredSlice
          }
        };
      });
      
      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);
      
      // Track all updates
      const valueUpdates: any[] = [];
      const doubledUpdates: any[] = [];
      const squaredUpdates: any[] = [];
      
      result.views.value.subscribe(v => valueUpdates.push(v));
      result.views.doubled.subscribe(v => doubledUpdates.push(v));
      result.views.squared.subscribe(v => squaredUpdates.push(v));
      
      // Rapid updates
      [1, 2, 3, 4, 5].forEach(n => {
        result.actions.get().update(n);
      });
      
      // All slices should have received all updates
      expect(valueUpdates).toHaveLength(5);
      expect(doubledUpdates).toHaveLength(5);
      expect(squaredUpdates).toHaveLength(5);
      
      // Final values should be consistent
      expect(valueUpdates[4]).toEqual({ val: 5 });
      expect(doubledUpdates[4]).toEqual({ doubled: 10 });
      expect(squaredUpdates[4]).toEqual({ squared: 25 });
    });

    it('should maintain consistency when multiple actions modify state simultaneously', () => {
      const component = createComponent(() => {
        const model = createModel<{
          accounts: Record<string, number>;
          transfer: (from: string, to: string, amount: number) => void;
          deposit: (account: string, amount: number) => void;
          withdraw: (account: string, amount: number) => void;
        }>(({ get, set }) => ({
          accounts: { alice: 100, bob: 50, charlie: 75 },
          
          transfer: (from: string, to: string, amount: number) => {
            const accounts = get().accounts;
            if (accounts[from]! >= amount) {
              set({
                accounts: {
                  ...accounts,
                  [from]: accounts[from]! - amount,
                  [to]: accounts[to]! + amount
                }
              });
            }
          },
          
          deposit: (account: string, amount: number) => {
            const accounts = get().accounts;
            set({
              accounts: {
                ...accounts,
                [account]: accounts[account]! + amount
              }
            });
          },
          
          withdraw: (account: string, amount: number) => {
            const accounts = get().accounts;
            if (accounts[account]! >= amount) {
              set({
                accounts: {
                  ...accounts,
                  [account]: accounts[account]! - amount
                }
              });
            }
          }
        }));
        
        return {
          model,
          actions: createSlice(model, m => ({
            transfer: m.transfer,
            deposit: m.deposit,
            withdraw: m.withdraw
          })),
          views: {}
        };
      });
      
      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);
      const actions = result.actions.get();
      
      // Simulate "concurrent" operations
      actions.transfer('alice', 'bob', 20);
      actions.deposit('charlie', 25);
      actions.withdraw('alice', 30);
      actions.transfer('bob', 'charlie', 15);
      actions.deposit('alice', 10);
      
      // Calculate expected values step by step
      // Initial: alice=100, bob=50, charlie=75 (total=225)
      // 1. alice->bob 20: alice=80, bob=70, charlie=75
      // 2. deposit charlie 25: alice=80, bob=70, charlie=100
      // 3. withdraw alice 30: alice=50, bob=70, charlie=100
      // 4. bob->charlie 15: alice=50, bob=55, charlie=115
      // 5. deposit alice 10: alice=60, bob=55, charlie=115
      // Total: 60 + 55 + 115 = 230
      
      const accounts = result.model.get().accounts;
      const total = accounts.alice! + accounts.bob! + accounts.charlie!;
      expect(total).toBe(230); // 225 + 35 deposits - 30 withdrawal
      
      // Individual accounts should be correct
      expect(accounts.alice).toBe(60);   // 100 - 20 - 30 + 10
      expect(accounts.bob).toBe(55);     // 50 + 20 - 15
      expect(accounts.charlie).toBe(115); // 75 + 25 + 15
    });

    it('should handle subscription/unsubscription during updates', () => {
      const component = createComponent(() => {
        const model = createModel<{
          value: number;
          increment: () => void;
        }>(({ get, set }) => ({
          value: 0,
          increment: () => set({ value: get().value + 1 })
        }));
        
        return {
          model,
          actions: createSlice(model, m => ({ increment: m.increment })),
          views: {
            value: createSlice(model, m => ({ val: m.value }))
          }
        };
      });
      
      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);
      
      const updates: number[] = [];
      const unsubscribes: Array<() => void> = [];
      
      // Create a listener that unsubscribes after 3 updates
      const autoUnsubListener = (state: { val: number }) => {
        updates.push(state.val);
        if (updates.length === 3) {
          unsubscribes[0]?.(); // Unsubscribe self
        }
      };
      
      // Subscribe multiple listeners
      unsubscribes.push(result.views.value.subscribe(autoUnsubListener));
      
      let permanentUpdates = 0;
      unsubscribes.push(
        result.views.value.subscribe(() => {
          permanentUpdates++;
        })
      );
      
      // Perform 5 updates
      for (let i = 0; i < 5; i++) {
        result.actions.get().increment();
      }
      
      // First listener should have only received 3 updates
      expect(updates).toEqual([1, 2, 3]);
      
      // Second listener should have received all 5
      expect(permanentUpdates).toBe(5);
    });

    it('should handle slices that depend on each other without infinite loops', () => {
      const component = createComponent(() => {
        const model = createModel<{
          a: number;
          b: number;
          updateA: () => void;
          updateB: () => void;
        }>(({ get, set }) => ({
          a: 1,
          b: 2,
          updateA: () => {
            const { b } = get();
            set({ a: b + 1 });
          },
          updateB: () => {
            const { a } = get();
            set({ b: a + 1 });
          }
        }));
        
        // Create slices that track individual fields
        const aSlice = createSlice(model, m => ({ value: m.a }));
        const bSlice = createSlice(model, m => ({ value: m.b }));
        
        return {
          model,
          actions: createSlice(model, m => ({
            updateA: m.updateA,
            updateB: m.updateB
          })),
          views: { a: aSlice, b: bSlice }
        };
      });
      
      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);
      
      const aValues: number[] = [];
      const bValues: number[] = [];
      
      result.views.a.subscribe((state) => aValues.push(state.value));
      result.views.b.subscribe((state) => bValues.push(state.value));
      
      // Update A: sets a = b + 1 = 3
      result.actions.get().updateA();
      
      // Both slices get notified when model changes
      expect(aValues.length).toBe(1);
      expect(bValues.length).toBe(1);
      expect(aValues[0]).toBe(3);
      expect(bValues[0]).toBe(2); // b didn't change yet
      
      // Update B: sets b = a + 1 = 4
      result.actions.get().updateB();
      
      // Both slices get notified again
      expect(aValues.length).toBe(2);
      expect(bValues.length).toBe(2);
      expect(aValues[1]).toBe(3); // a didn't change
      expect(bValues[1]).toBe(4); // b changed
      
      // Values should be correct
      expect(result.views.a.get().value).toBe(3);
      expect(result.views.b.get().value).toBe(4);
    });
  });

  /**
   * Tests for subscription ordering and consistency
   */
  describe('subscription ordering', () => {
    it('should notify subscribers in registration order', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;
      
      const store = primitives.createStore({ value: 0 });
      const order: number[] = [];
      
      // Register multiple subscribers
      store.subscribe(() => order.push(1));
      store.subscribe(() => order.push(2));
      store.subscribe(() => order.push(3));
      
      // Update
      store.set({ value: 1 });
      
      // Should be notified in order
      expect(order).toEqual([1, 2, 3]);
    });

    it('should handle nested subscription updates correctly', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;
      
      const store = primitives.createStore({ count: 0, flag: false });
      const updates: Array<{ count: number; flag: boolean }> = [];
      
      // Subscriber that triggers another update
      store.subscribe((state) => {
        updates.push({ ...state });
        
        // Only trigger once to avoid infinite loop
        if (state.count === 1 && !state.flag) {
          // This update happens during notification
          store.set({ count: state.count, flag: true });
        }
      });
      
      // Trigger initial update
      store.set({ count: 1, flag: false });
      
      // Should have two updates
      expect(updates).toHaveLength(2);
      expect(updates[0]).toEqual({ count: 1, flag: false });
      expect(updates[1]).toEqual({ count: 1, flag: true });
    });

    it('should maintain slice cache consistency during rapid updates', () => {
      const component = createComponent(() => {
        const model = createModel<{
          data: number[];
          push: (value: number) => void;
          clear: () => void;
        }>(({ get, set }) => ({
          data: [],
          push: (value: number) => {
            set({ data: [...get().data, value] });
          },
          clear: () => set({ data: [] })
        }));
        
        const dataSlice = createSlice(model, m => ({ items: m.data }));
        
        // Nested slices with select()
        const statsSlice = createSlice(model, (m) => ({
          data: select(dataSlice),
          count: m.data.length
        }));
        
        return {
          model,
          actions: createSlice(model, m => ({
            push: m.push,
            clear: m.clear
          })),
          views: {
            stats: statsSlice
          }
        };
      });
      
      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);
      
      const updates: any[] = [];
      result.views.stats.subscribe(stats => updates.push(stats));
      
      // Rapid operations
      result.actions.get().push(1);
      result.actions.get().push(2);
      result.actions.get().clear();
      result.actions.get().push(3);
      result.actions.get().push(4);
      result.actions.get().push(5);
      
      // All updates should be consistent
      expect(updates).toHaveLength(6);
      
      // Final state
      const final = updates[5];
      expect(final.data.items).toEqual([3, 4, 5]);
      expect(final.count).toBe(3);
      
      // Verify cache consistency
      const current = result.views.stats.get();
      expect(current.data.items).toEqual([3, 4, 5]);
      expect(current.count).toBe(3);
    });
  });

  /**
   * Performance and stress tests
   */
  describe('performance under load', () => {
    it('should handle many subscribers efficiently', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;
      
      const store = primitives.createStore({ value: 0 });
      const slice = primitives.createSlice(store, s => ({ val: s.value }));
      
      // Add many subscribers
      const unsubscribes: Array<() => void> = [];
      const updateCounts = new Array(100).fill(0);
      
      for (let i = 0; i < 100; i++) {
        const index = i;
        unsubscribes.push(
          slice.subscribe(() => {
            updateCounts[index]++;
          })
        );
      }
      
      // Update
      store.set({ value: 1 });
      
      // All should have been notified exactly once
      expect(updateCounts.every(count => count === 1)).toBe(true);
      
      // Cleanup
      unsubscribes.forEach(unsub => unsub());
    });

    it('should handle deep slice composition chains', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;
      
      const store = primitives.createStore({ value: 1 });
      
      // Create a deep chain of slices
      let currentSlice = primitives.createSlice(store, s => ({ n: s.value }));
      
      for (let i = 0; i < 10; i++) {
        const prevSlice = currentSlice;
        currentSlice = primitives.createSlice(prevSlice, s => ({
          n: s.n + 1
        }));
      }
      
      // Final slice should compute correctly
      expect(currentSlice.get()).toEqual({ n: 11 }); // 1 + 10
      
      // Update should propagate through the chain
      let updateReceived = false;
      currentSlice.subscribe(() => {
        updateReceived = true;
      });
      
      store.set({ value: 2 });
      expect(updateReceived).toBe(true);
      expect(currentSlice.get()).toEqual({ n: 12 }); // 2 + 10
    });
  });
});