/**
 * Tests for the memory adapter
 */

import { describe, it, expect } from 'vitest';
import { createMemoryAdapter } from './index';
import { createAdapterTestSuite, createComponent, createModel, createSlice } from '@lattice/core';

// Run the shared adapter test suite
createAdapterTestSuite('Memory', createMemoryAdapter);

// Additional memory-specific tests
describe('Memory Adapter Specific Features', () => {
  it('should provide getState() for testing', () => {
    const counter = createComponent(() => {
      const model = createModel<{ count: number; increment: () => void }>(
        ({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 })
        })
      );

      const actions = createSlice(model, (m, _api) => ({
        increment: m.increment
      }));

      const views = {
        count: createSlice(model, (m, _api) => ({ value: m.count }))
      };

      return { model, actions, views };
    });

    const adapter = createMemoryAdapter(counter);

    // Test getState() method
    expect(adapter.getState()).toEqual({ count: 0, increment: expect.any(Function) });
    
    adapter.actions.increment();
    
    expect(adapter.getState()).toEqual({ count: 1, increment: expect.any(Function) });
  });

  it('should provide destroy() for cleanup', () => {
    const component = createComponent(() => {
      const model = createModel<{ value: string }>(
        () => ({ value: 'test' })
      );

      return {
        model,
        actions: createSlice(model, (_m, _api) => ({})),
        views: {
          value: createSlice(model, (m, _api) => ({ text: m.value }))
        }
      };
    });

    const adapter = createMemoryAdapter(component);
    
    // Should work before destroy
    expect(adapter.views.value().text).toBe('test');
    
    // Destroy the adapter
    adapter.destroy();
    
    // After destroy, stores should still return values but subscriptions are cleaned up
    expect(adapter.views.value().text).toBe('test');
  });

  it('should handle nested object updates correctly', () => {
    const component = createComponent(() => {
      const model = createModel<{
        user: { name: string; email: string };
        updateName: (name: string) => void;
      }>(({ set, get }) => ({
        user: { name: 'Alice', email: 'alice@example.com' },
        updateName: (name: string) => set({ 
          user: { ...get().user, name } 
        })
      }));

      const actions = createSlice(model, (m, _api) => ({
        updateName: m.updateName
      }));

      const views = {
        user: createSlice(model, (m, _api) => m.user)
      };

      return { model, actions, views };
    });

    const adapter = createMemoryAdapter(component);
    
    expect(adapter.views.user()).toEqual({ 
      name: 'Alice', 
      email: 'alice@example.com' 
    });
    
    adapter.actions.updateName('Bob');
    
    expect(adapter.views.user()).toEqual({ 
      name: 'Bob', 
      email: 'alice@example.com' 
    });
  });
});