import { describe, expect, it } from 'vitest';
import { createStore } from './index';
import { resolve } from './resolve';

describe('resolve with createStore', () => {
  it('should create computed values from slices', () => {
    const createSlice = createStore({ count: 10, multiplier: 2, label: 'Items' });
    
    const counter = createSlice(({ get, set }) => ({
      count: () => get().count,
      increment: () => set({ count: get().count + 1 })
    }));
    
    const settings = createSlice(({ get }) => ({
      multiplier: () => get().multiplier,
      label: () => get().label
    }));
    
    // Create selector factory
    const select = resolve({ counter, settings });
    
    // Create computed values
    const computed = select(({ counter, settings }) => ({
      total: counter.count() * settings.multiplier(),
      summary: `${settings.label()}: ${counter.count()}`,
      isPositive: counter.count() > 0
    }));
    
    expect(computed.total).toBe(20); // 10 * 2
    expect(computed.summary).toBe('Items: 10');
    expect(computed.isPositive).toBe(true);
    
    // Values update when state changes
    counter.increment();
    
    const updated = select(({ counter, settings }) => ({
      total: counter.count() * settings.multiplier()
    }));
    
    expect(updated.total).toBe(22); // 11 * 2
  });

  it('should support parameterized selectors', () => {
    const createSlice = createStore({ count: 50, threshold: 100 });
    
    const counter = createSlice(({ get }) => ({
      count: () => get().count
    }));
    
    const settings = createSlice(({ get }) => ({
      threshold: () => get().threshold
    }));
    
    const select = resolve({ counter, settings });
    
    // Create parameterized selector
    const createRangeChecker = select(({ counter, settings }) => (min: number, max: number) => ({
      inRange: counter.count() >= min && counter.count() <= max,
      belowThreshold: counter.count() < settings.threshold(),
      percentOfMax: Math.round((counter.count() / max) * 100),
      description: `${counter.count()} is ${
        counter.count() >= min && counter.count() <= max ? 'within' : 'outside'
      } range [${min}, ${max}]`
    }));
    
    const range1 = createRangeChecker(0, 100);
    expect(range1.inRange).toBe(true);
    expect(range1.belowThreshold).toBe(true);
    expect(range1.percentOfMax).toBe(50);
    expect(range1.description).toBe('50 is within range [0, 100]');
    
    const range2 = createRangeChecker(60, 80);
    expect(range2.inRange).toBe(false);
    expect(range2.description).toBe('50 is outside range [60, 80]');
  });

  it('should support mixed direct values and factory functions', () => {
    const createSlice = createStore({ 
      todos: [
        { id: 1, text: 'Task 1', completed: false },
        { id: 2, text: 'Task 2', completed: true },
        { id: 3, text: 'Task 3', completed: false }
      ],
      filter: 'all' as 'all' | 'active' | 'completed'
    });
    
    const todos = createSlice(({ get }) => ({
      all: () => get().todos,
      active: () => get().todos.filter(t => !t.completed),
      completed: () => get().todos.filter(t => t.completed)
    }));
    
    const filters = createSlice(({ get }) => ({
      current: () => get().filter
    }));
    
    const select = resolve({ todos, filters });
    
    const analytics = select(({ todos, filters }) => ({
      // Direct computed values
      totalCount: todos.all().length,
      activeCount: todos.active().length,
      completedCount: todos.completed().length,
      currentFilter: filters.current(),
      
      // Factory for detailed reports
      createReport: (includeItems: boolean) => ({
        summary: `${todos.active().length} active, ${todos.completed().length} completed`,
        filter: filters.current(),
        items: includeItems ? todos.all() : undefined,
        timestamp: Date.now()
      })
    }));
    
    expect(analytics.totalCount).toBe(3);
    expect(analytics.activeCount).toBe(2);
    expect(analytics.completedCount).toBe(1);
    
    const report = analytics.createReport(false);
    expect(report.summary).toBe('2 active, 1 completed');
    expect(report.items).toBeUndefined();
    
    const detailedReport = analytics.createReport(true);
    expect(detailedReport.items).toHaveLength(3);
  });
});