import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { createComponent, type ComponentContext } from '@lattice/core';
import { useSignal } from './react';

describe('React rapid updates test', () => {
  it('should handle rapid updates without issues', () => {
    const Counter = ({ store, set }: ComponentContext<{ count: number }>) => ({
      value: store.count,
      increment: () => set(store.count, store.count() + 1),
    });
    
    const context = createComponent({ count: 0 });
    const counter = Counter(context);
    
    const { result } = renderHook(() => useSignal(counter.value));
    
    // Perform many rapid updates
    act(() => {
      for (let i = 1; i <= 100; i++) {
        context.set(context.store.count, i);
      }
    });
    
    expect(result.current).toBe(100);
  });
});