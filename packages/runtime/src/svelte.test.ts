import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
import { vanillaAdapter, createLatticeStore, type Selectors, type SetState } from '@lattice/core';
import { asStore, sliceDerived, combineSlices, asyncDerived, memoized } from './svelte.js';

describe('Svelte runtime utilities - New slice-based API', () => {
  // Create test slices
  const createTestSlices = () => {
    const adapter = vanillaAdapter({
      count: 0,
      name: 'test',
      items: [] as string[],
    });
    const createSlice = createLatticeStore(adapter);

    const counterSlice = createSlice(
      (selectors: Selectors<{ count: number; name: string; items: string[] }>) => ({ count: selectors.count }),
      ({ count }: { count: () => number }, set: SetState<{ count: number; name: string; items: string[] }>) => ({
        value: () => count(),
        increment: () => set(
          (selectors: Selectors<{ count: number; name: string; items: string[] }>) => ({ count: selectors.count }),
          ({ count }: { count: () => number }) => ({ count: count() + 1 })
        ),
        doubled: () => count() * 2,
      })
    );
    
    const userSlice = createSlice(
      (selectors: Selectors<{ count: number; name: string; items: string[] }>) => ({ name: selectors.name }),
      ({ name }: { name: () => string }, set: SetState<{ count: number; name: string; items: string[] }>) => ({
        name: () => name(),
        setName: (newName: string) => set(
          (selectors: Selectors<{ count: number; name: string; items: string[] }>) => ({ name: selectors.name }),
          () => ({ name: newName })
        ),
      })
    );

    const itemsSlice = createSlice(
      (selectors: Selectors<{ count: number; name: string; items: string[] }>) => ({ items: selectors.items }),
      ({ items }: { items: () => string[] }, set: SetState<{ count: number; name: string; items: string[] }>) => ({
        all: () => items(),
        add: (item: string) => set(
          (selectors: Selectors<{ count: number; name: string; items: string[] }>) => ({ items: selectors.items }),
          ({ items }: { items: () => string[] }) => ({ items: [...items(), item] })
        ),
      })
    );

    return { counterSlice, userSlice, itemsSlice };
  };
  
  describe('asStore', () => {
    it('should create a Svelte store from a slice', () => {
      const { counterSlice } = createTestSlices();
      const counter = asStore(counterSlice);
      
      expect(get(counter).value()).toBe(0);
      expect(get(counter).doubled()).toBe(0);
    });

    it('should update when slice changes', () => {
      const { counterSlice } = createTestSlices();
      const counter = asStore(counterSlice);
      
      const values: number[] = [];
      counter.subscribe(c => values.push(c.value()));
      
      // Initial value
      expect(values[0]).toBe(0);
      
      // Update slice
      get(counter).increment();
      expect(values[1]).toBe(1);
      expect(get(counter).value()).toBe(1);
      expect(get(counter).doubled()).toBe(2);
    });

    it('should have fine-grained reactivity (not update for unrelated changes)', () => {
      const { counterSlice, userSlice } = createTestSlices();
      const counter = asStore(counterSlice);
      
      let updateCount = 0;
      counter.subscribe(() => updateCount++);
      
      // Change unrelated slice - should NOT trigger counter updates
      userSlice().setName('Alice');
      expect(updateCount).toBe(1); // Only initial subscription
      
      // Change counter slice - should trigger update
      get(counter).increment();
      expect(updateCount).toBe(2);
    });
  });

  describe('sliceDerived', () => {
    it('should create a derived store that only updates when slice changes', () => {
      const { counterSlice } = createTestSlices();
      
      const doubled = sliceDerived(counterSlice, c => c.value() * 2);
      const isEven = sliceDerived(counterSlice, c => c.value() % 2 === 0);
      
      // Subscribe to activate the stores
      doubled.subscribe(() => {});
      isEven.subscribe(() => {});
      
      expect(get(doubled)).toBe(0);
      expect(get(isEven)).toBe(true);
      
      counterSlice().increment();
      expect(get(doubled)).toBe(2);
      expect(get(isEven)).toBe(false);
    });

    it('should not update for unrelated changes', () => {
      const { counterSlice, userSlice } = createTestSlices();
      
      const doubled = sliceDerived(counterSlice, c => c.value() * 2);
      let updateCount = 0;
      doubled.subscribe(() => updateCount++);
      
      // Change unrelated slice
      userSlice().setName('Alice');
      expect(updateCount).toBe(1); // Only initial subscription
      
      // Change related slice
      counterSlice().increment();
      expect(updateCount).toBe(2);
    });
  });

  describe('combineSlices', () => {
    it('should combine multiple slices efficiently', () => {
      const { counterSlice, userSlice } = createTestSlices();
      
      const summary = combineSlices(
        [counterSlice, userSlice],
        (counter, user) => `${user.name()}: ${counter.value()}`
      );
      
      // Subscribe to activate the store
      summary.subscribe(() => {});
      
      expect(get(summary)).toBe('test: 0');
      
      counterSlice().increment();
      expect(get(summary)).toBe('test: 1');
      
      userSlice().setName('Alice');
      expect(get(summary)).toBe('Alice: 1');
    });

    it('should only update when relevant slices change', () => {
      const { counterSlice, userSlice, itemsSlice } = createTestSlices();
      
      const summary = combineSlices(
        [counterSlice, userSlice],
        (counter, user) => `${user.name()}: ${counter.value()}`
      );
      
      let updateCount = 0;
      summary.subscribe(() => updateCount++);
      
      // Change unrelated slice - should NOT trigger update
      itemsSlice().add('test');
      expect(updateCount).toBe(1); // Only initial subscription
      
      // Change related slice - should trigger update
      counterSlice().increment();
      expect(updateCount).toBe(2);
      
      userSlice().setName('Bob');
      expect(updateCount).toBe(3);
    });

    it('should handle complex combinations', () => {
      const { counterSlice, userSlice, itemsSlice } = createTestSlices();
      
      const dashboard = combineSlices(
        [counterSlice, userSlice, itemsSlice],
        (counter, user, items) => ({
          greeting: `Welcome back, ${user.name()}!`,
          stats: `${counter.value()} clicks, ${items.all().length} items`,
          isActive: counter.value() > 0 && items.all().length > 0
        })
      );
      
      // Subscribe to activate the store
      dashboard.subscribe(() => {});
      
      expect(get(dashboard)).toEqual({
        greeting: 'Welcome back, test!',
        stats: '0 clicks, 0 items',
        isActive: false
      });
      
      counterSlice().increment();
      itemsSlice().add('item1');
      userSlice().setName('Alice');
      
      expect(get(dashboard)).toEqual({
        greeting: 'Welcome back, Alice!',
        stats: '1 clicks, 1 items',
        isActive: true
      });
    });
  });

  describe('asyncDerived', () => {
    it('should handle async operations with loading states', async () => {
      const { userSlice } = createTestSlices();
      
      const userData = asyncDerived(userSlice, async user => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 10));
        return { email: `${user.name()}@example.com`, id: 123 };
      });
      
      const values: any[] = [];
      userData.subscribe(state => values.push({ ...state }));
      
      // Initial loading state (starts with loading: true because async operation runs immediately)
      expect(values[0]).toEqual({ data: undefined, loading: true, error: null });
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Should have success state
      expect(values[1]).toEqual({ 
        data: { email: 'test@example.com', id: 123 }, 
        loading: false, 
        error: null 
      });
    });

    it('should handle errors gracefully', async () => {
      const { userSlice } = createTestSlices();
      
      const userData = asyncDerived(userSlice, async () => {
        throw new Error('API Error');
      });
      
      const values: any[] = [];
      userData.subscribe(state => values.push({ ...state }));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(values[values.length - 1]).toEqual({
        data: undefined,
        loading: false,
        error: expect.objectContaining({ message: 'API Error' })
      });
    });

    it('should re-run when slice changes', async () => {
      const { userSlice } = createTestSlices();
      let callCount = 0;
      
      const userData = asyncDerived(userSlice, async user => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 5));
        return { name: user.name(), callCount };
      });
      
      // Subscribe to activate
      userData.subscribe(() => {});
      
      // Wait for initial call
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(callCount).toBe(1);
      
      // Change slice - should trigger re-run
      userSlice().setName('Alice');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(callCount).toBe(2);
      
      const finalValue = get(userData);
      expect(finalValue.data).toEqual({ name: 'Alice', callCount: 2 });
    });
  });

  describe('memoized', () => {
    it('should memoize expensive computations', () => {
      // Create fresh slice for this test to avoid contamination
      const adapter = vanillaAdapter({ count: 0 });
      const createSlice = createLatticeStore(adapter);
      
      const counterSlice = createSlice(
        (selectors) => ({ count: selectors.count }),
        ({ count }, set) => ({
          value: () => count(),
          increment: () => set(
            (selectors) => ({ count: selectors.count }),
            ({ count }) => ({ count: count() + 1 })
          ),
        })
      );
      
      // Verify slice works correctly first
      expect(counterSlice().value()).toBe(0);
      
      let computationCount = 0;
      
      const expensiveResult = memoized(counterSlice, counter => {
        computationCount++;
        return counter.value() * counter.value(); // Expensive square operation
      });
      
      // Subscribe to activate
      expensiveResult.subscribe(() => {});
      
      // Verify initial state is still correct after creating memoized store
      expect(counterSlice().value()).toBe(0);
      
      // First access 
      expect(get(expensiveResult)).toBe(0);
      expect(computationCount).toBe(1);
      
      // Second access with same value - should use cache
      expect(get(expensiveResult)).toBe(0);
      expect(computationCount).toBe(1); // Still 1!
      
      // Change value - should recompute
      counterSlice().increment();
      
      // Verify slice changed
      expect(counterSlice().value()).toBe(1);
      
      expect(get(expensiveResult)).toBe(1);
      expect(computationCount).toBe(2);
    });

    it('should avoid recomputation until slice changes', () => {
      const { counterSlice } = createTestSlices();
      let computationCount = 0;
      
      const expensiveResult = memoized(
        counterSlice, 
        counter => {
          computationCount++;
          return counter.value() * 2;
        }
      );
      
      // Subscribe to activate
      expensiveResult.subscribe(() => {});
      
      // Multiple accesses without slice changes - should not recompute
      get(expensiveResult); // Uses cached result
      get(expensiveResult); // Uses cached result
      get(expensiveResult); // Uses cached result
      
      expect(computationCount).toBe(1); // Only computed once
      
      // Change slice - should recompute
      counterSlice().increment(); // value = 1
      expect(get(expensiveResult)).toBe(2); // 1 * 2
      expect(computationCount).toBe(2); // Computed again
      
      // More accesses without changes - should use cache
      get(expensiveResult);
      get(expensiveResult);
      expect(computationCount).toBe(2); // Still only 2 computations
    });
  });
});