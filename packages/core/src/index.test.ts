import { describe, it, expect } from 'vitest';
import { createModel, createSlice } from './index';

describe('createModel', () => {
  it('should create a model factory function', () => {
    interface CountModel {
      count: number;
      increment: () => void;
    }
    
    const modelFactory = createModel<CountModel>(({ set, get }) => ({
      count: 0,
      increment: () => set({ count: get().count + 1 })
    }));

    expect(typeof modelFactory).toBe('function');
  });
});

describe('createSlice', () => {
  it('should create a slice factory function', () => {
    interface TestModel {
      count: number;
      name: string;
    }
    
    const modelFactory = createModel<TestModel>(() => ({
      count: 0,
      name: 'test'
    }));

    const sliceFactory = createSlice(modelFactory, (m) => ({
      count: m.count
    }));

    expect(typeof sliceFactory).toBe('function');
  });
});

describe('select', () => {
  it('should be a function', async () => {
    const { select } = await import('./index');
    expect(typeof select).toBe('function');
  });
});

describe('createComponent', () => {
  it('should create a component factory', async () => {
    const { createComponent } = await import('./index');
    
    interface CounterModel {
      count: number;
      increment: () => void;
    }
    
    const counter = createComponent(() => {
      const model = createModel<CounterModel>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 })
      }));

      const actions = createSlice(model, (m) => ({
        increment: m.increment
      }));

      return {
        model,
        actions,
        views: {}
      };
    });

    expect(typeof counter).toBe('function');
  });
});

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;

  it('should export createModel', () => {
    expect(createModel).toBeDefined();
  });

  it('should export createSlice', () => {
    expect(createSlice).toBeDefined();
  });
}