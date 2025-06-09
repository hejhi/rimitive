import { describe, it, expect, vi } from 'vitest';
import { resolve } from './resolve';
import {
  createModel,
  createSlice,
  type ModelFactory,
} from './index';

describe('resolve', () => {
  it('should create views that resolve dependencies fresh on each call', () => {
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

    // Create views
    const multipliedView = compute(
      ({ counter }) =>
        (multiplier: number) => ({
          value: counter.count() * multiplier,
          label: `×${multiplier}: ${counter.count()}`,
          percentage: (counter.count() * multiplier * 100) / counter.total(),
        })
    );

    const summaryView = compute(({ counter, stats }) => () => ({
      total: counter.total(),
      count: counter.count(),
      average: stats.average(),
      description: `Count: ${counter.count()}, Average: ${stats.average()}`,
    }));

    // Create a mock state
    let state = { count: 10, total: 100, increment: vi.fn() };
    const getState = () => state;

    // Views should be functions that take a getState function
    const multiplied = multipliedView(getState);
    const summary = summaryView(getState);

    // Test multiplied view
    const doubled = multiplied(2);
    expect(doubled.value).toBe(20);
    expect(doubled.label).toBe('×2: 10');
    expect(doubled.percentage).toBe(20);

    // Test summary view
    const currentSummary = summary();
    expect(currentSummary.total).toBe(100);
    expect(currentSummary.count).toBe(10);
    expect(currentSummary.average).toBe(10);

    // Update state and verify views see fresh data
    state = { count: 20, total: 100, increment: vi.fn() };
    
    const newDoubled = multiplied(2);
    expect(newDoubled.value).toBe(40);
    expect(newDoubled.label).toBe('×2: 20');
    
    const newSummary = summary();
    expect(newSummary.count).toBe(20);
  });

  it('should compute fresh results each time', () => {
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

    const state = { value: 42 };
    const view = computedView(() => state);

    // First call with parameter 2
    const result1 = view(2);
    expect(result1.result).toBe(84);
    expect(computationCount).toBe(1);

    // Second call with same parameter - computed fresh (no memoization for now)
    const result2 = view(2);
    expect(result2.result).toBe(84);
    expect(computationCount).toBe(2); // Computed again

    // Different parameter
    const result3 = view(3);
    expect(result3.result).toBe(126);
    expect(computationCount).toBe(3);
  });

  it('should work with no dependencies', () => {
    const model = createModel<{ data: string }>(() => ({ data: 'test' }));

    // Create compute with empty dependencies
    const compute = resolve(model, {});

    const constantView = compute(() => () => ({
      fixed: 100,
      message: 'No deps needed',
    }));

    const state = { data: 'test' };
    const view = constantView(() => state);
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

    const state = { x: 5, y: 10 };
    const distance = distanceView(() => state);

    // Distance from (5,10) to (0,0)
    const dist1 = distance(0, 0);
    expect(dist1).toBeCloseTo(11.18, 2);

    // Distance from (5,10) to (5,10) - should be 0
    const dist2 = distance(5, 10);
    expect(dist2).toBe(0);
  });

  it('should compute fresh objects each time', () => {
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

    const state = { data: { id: 1, name: 'test' } };
    const transform = transformView(() => state);

    // Call twice with same parameter
    const result1 = transform('Item');
    const result2 = transform('Item');

    // Without memoization, these are different objects
    expect(result1).not.toBe(result2);
    expect(result1.transformed).not.toBe(result2.transformed);
    
    // But they have the same values
    expect(result1).toEqual(result2);
  });

  it('should access fresh state through getter functions', () => {
    const model = createModel<{ a: number; b: number }>(
      ({ set, get }) => ({
        a: 1,
        b: 2,
        setA: (val: number) => set({ a: val }),
        setB: (val: number) => set({ b: val }),
      })
    );

    const aSlice = createSlice(model, (m) => ({
      value: () => m().a,
      doubled: () => m().a * 2,
    }));

    const bSlice = createSlice(model, (m) => ({
      value: () => m().b,
      tripled: () => m().b * 3,
    }));

    const compute = resolve(model, { a: aSlice, b: bSlice });

    const sumView = compute(
      ({ a, b }) => () => ({
        sum: a.value() + b.value(),
        computed: a.doubled() + b.tripled(),
      })
    );

    let state = { a: 1, b: 2, setA: vi.fn(), setB: vi.fn() };
    const getState = () => state;
    
    const view = sumView(getState);
    
    // First call
    const result1 = view();
    expect(result1.sum).toBe(3);
    expect(result1.computed).toBe(8); // (1*2) + (2*3)

    // Update state
    state = { a: 5, b: 10, setA: vi.fn(), setB: vi.fn() };
    
    // Second call - getter functions should see fresh state
    const result2 = view();
    expect(result2.sum).toBe(15);
    expect(result2.computed).toBe(40); // (5*2) + (10*3)
  });
});