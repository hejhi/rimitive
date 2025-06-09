import { describe, it, expect } from 'vitest';
import { resolve } from './resolve';
import {
  createModel,
  createSlice,
  type SliceFactory,
  type ModelFactory,
} from './index';

// Simple test adapter for testing
function createTestAdapter<T>(modelFactory: ModelFactory<T>) {
  let state: T;

  // Initialize model
  const model = modelFactory({
    get: () => state,
    set: (updates) => {
      state = { ...state, ...updates };
    },
  });

  state = model;

  return {
    getState: () => state,
    executeSlice: <S>(sliceFactory: SliceFactory<T, S>): S => {
      return sliceFactory(() => state);
    },
  };
}

describe('resolve', () => {
  it('should create a bound compute function with dependencies', () => {
    // Define model
    const model = createModel<{ count: number; total: number }>(
      ({ set, get }) => ({
        count: 10,
        total: 100,
        increment: () => set({ count: get().count + 1 }),
      })
    );

    // Define base slices
    const counterSlice = createSlice(model, (m) => ({
      count: () => m().count,
      total: () => m().total,
    }));

    const statsSlice = createSlice(model, (m) => ({
      average: () => m().total / 10,
      isEmpty: () => m().count === 0,
    }));

    // Bind slices to model
    const compute = resolve(model, {
      counter: counterSlice,
      stats: statsSlice,
    });

    // Create multiple computed views with the same dependencies
    const multipliedCounter = compute(
      ({ counter }) =>
        (multiplier: number) => ({
          value: counter.count() * multiplier,
          label: `×${multiplier}: ${counter.count()}`,
          percentage: (counter.count() * multiplier * 100) / counter.total(),
        })
    );

    const summary = compute(({ counter, stats }) => () => ({
      total: counter.total(),
      count: counter.count(),
      average: stats.average(),
      description: `Count: ${counter.count()}, Average: ${stats.average()}`,
    }));

    // Create test adapter
    const store = createTestAdapter(model);

    // Test multiplied counter view
    const multipliedView = store.executeSlice(multipliedCounter);
    const doubled = multipliedView(2);
    expect(doubled.value).toBe(20);
    expect(doubled.label).toBe('×2: 10');
    expect(doubled.percentage).toBe(20);

    const tripled = multipliedView(3);
    expect(tripled.value).toBe(30);
    expect(tripled.label).toBe('×3: 10');
    expect(tripled.percentage).toBe(30);

    // Test summary view
    const summaryView = store.executeSlice(summary);
    const currentSummary = summaryView();
    expect(currentSummary.total).toBe(100);
    expect(currentSummary.count).toBe(10);
    expect(currentSummary.average).toBe(10);
    expect(currentSummary.description).toBe('Count: 10, Average: 10');
  });

  it('should memoize parameterized views', () => {
    const model = createModel<{ value: number }>(() => ({ value: 42 }));
    const valueSlice = createSlice(model, (m) => ({
      get: () => m().value,
    }));

    let computationCount = 0;
    const compute = resolve(model, { value: valueSlice });

    const computedView = compute(({ value }) => (multiplier: number) => {
      computationCount++;
      return {
        result: value.get() * multiplier,
        computationCount,
      };
    });

    const store = createTestAdapter(model);
    const view = store.executeSlice(computedView);

    // Reset count after initial factory execution
    computationCount = 0;

    // First call with parameter 2
    const result1 = view(2);
    expect(result1.result).toBe(84);
    expect(computationCount).toBe(1);

    // Second call with same parameter - should be memoized
    const result2 = view(2);
    expect(result2.result).toBe(84);
    expect(result2.computationCount).toBe(1); // Same count, was memoized
    expect(computationCount).toBe(1); // Still 1

    // Different parameter - new computation
    const result3 = view(3);
    expect(result3.result).toBe(126);
    expect(computationCount).toBe(2);
  });

  it('should work with no dependencies', () => {
    const model = createModel<{ data: string }>(() => ({ data: 'test' }));

    // Create compute with empty dependencies
    const compute = resolve(model, {});

    const constantView = compute(() => () => ({
      fixed: 100,
      message: 'No deps needed',
    }));

    const store = createTestAdapter(model);
    const view = store.executeSlice(constantView);
    const result = view();

    expect(result.fixed).toBe(100);
    expect(result.message).toBe('No deps needed');
  });

  it('should support multiple parameters', () => {
    const model = createModel<{ x: number; y: number }>(() => ({
      x: 5,
      y: 10,
    }));

    const coordSlice = createSlice(model, (m) => ({
      x: () => m().x,
      y: () => m().y,
    }));

    const compute = resolve(model, { coord: coordSlice });

    const distanceView = compute(({ coord }) => (x2: number, y2: number) => {
      const dx = coord.x() - x2;
      const dy = coord.y() - y2;
      return Math.sqrt(dx * dx + dy * dy);
    });

    const store = createTestAdapter(model);
    const distance = store.executeSlice(distanceView);

    // Distance from (5,10) to (0,0)
    const dist1 = distance(0, 0);
    expect(dist1).toBeCloseTo(11.18, 2);

    // Distance from (5,10) to (5,10) - should be 0
    const dist2 = distance(5, 10);
    expect(dist2).toBe(0);
  });

  it('should support rest parameters', () => {
    const model = createModel<{ items: number[] }>(() => ({
      items: [1, 2, 3],
    }));

    const itemsSlice = createSlice(model, (m) => ({
      all: () => m().items,
    }));

    const compute = resolve(model, { items: itemsSlice });

    const sumView = compute(({ items }) => (...numbers: number[]) => {
      const base = items.all().reduce((a, b) => a + b, 0);
      const additional = numbers.reduce((a, b) => a + b, 0);
      return base + additional;
    });

    const store = createTestAdapter(model);
    const sum = store.executeSlice(sumView);

    expect(sum()).toBe(6); // 1+2+3
    expect(sum(4)).toBe(10); // 1+2+3+4
    expect(sum(4, 5, 6)).toBe(21); // 1+2+3+4+5+6
  });

  it('should cache slice execution per adapter context', () => {
    const model = createModel<{ value: number }>(({ set, get }) => ({
      value: 100,
      double: () => set({ value: get().value * 2 }),
    }));

    let sliceCallCount = 0;
    const trackingSlice = createSlice(model, (m) => {
      sliceCallCount++;
      return {
        value: () => m().value,
        callCount: sliceCallCount,
      };
    });

    const compute = resolve(model, { tracking: trackingSlice });

    const view = compute(({ tracking }) => () => ({
      value: tracking.value(),
      sliceWasCalledTimes: tracking.callCount,
    }));

    // Create first adapter
    const store1 = createTestAdapter(model);
    sliceCallCount = 0; // Reset after model initialization

    const view1 = store1.executeSlice(view);
    const result1a = view1();
    expect(result1a.value).toBe(100);
    expect(result1a.sliceWasCalledTimes).toBe(1);

    // Call again on same adapter - slice should be cached
    const result1b = view1();
    expect(result1b.value).toBe(100);
    expect(result1b.sliceWasCalledTimes).toBe(1); // Still 1, was cached

    // Create second adapter - should have its own cache
    const store2 = createTestAdapter(model);
    const view2 = store2.executeSlice(view);
    const result2 = view2();
    expect(result2.value).toBe(100);
    expect(result2.sliceWasCalledTimes).toBe(2); // New execution for new adapter
  });

  it('should maintain referential equality for memoized results', () => {
    const model = createModel<{ data: { id: number; name: string } }>(() => ({
      data: { id: 1, name: 'test' },
    }));

    const dataSlice = createSlice(model, (m) => ({
      get: () => m().data,
    }));

    const compute = resolve(model, { data: dataSlice });

    const transformView = compute(({ data }) => (prefix: string) => ({
      transformed: {
        id: data.get().id,
        label: `${prefix}: ${data.get().name}`,
      },
    }));

    const store = createTestAdapter(model);
    const transform = store.executeSlice(transformView);

    // Call twice with same parameter
    const result1 = transform('Item');
    const result2 = transform('Item');

    // Should be the exact same object reference
    expect(result1).toBe(result2);
    expect(result1.transformed).toBe(result2.transformed);
  });

  it('should create independent compute functions from the same resolve', () => {
    const model = createModel<{ a: number; b: number }>(() => ({
      a: 10,
      b: 20,
    }));

    const aSlice = createSlice(model, (m) => ({
      value: () => m().a,
    }));

    const bSlice = createSlice(model, (m) => ({
      value: () => m().b,
    }));

    // Create one compute binding
    const compute = resolve(model, { a: aSlice, b: bSlice });

    // Create multiple independent views
    const sumView = compute(
      ({ a, b }) =>
        () =>
          a.value() + b.value()
    );

    const productView = compute(
      ({ a, b }) =>
        () =>
          a.value() * b.value()
    );

    const ratioView = compute(
      ({ a, b }) =>
        () =>
          a.value() / b.value()
    );

    const store = createTestAdapter(model);

    const sum = store.executeSlice(sumView)();
    const product = store.executeSlice(productView)();
    const ratio = store.executeSlice(ratioView)();

    expect(sum).toBe(30);
    expect(product).toBe(200);
    expect(ratio).toBe(0.5);
  });
});
