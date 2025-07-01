import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { createComponent, type ComponentContext } from '@lattice/core';
import { useSignal } from './react';

describe('React cleanup test', () => {
  it('should cleanup subscriptions on unmount', () => {
    const Counter = ({ store, set }: ComponentContext<{ count: number }>) => ({
      value: store.count,
      increment: () => set(store.count, store.count() + 1),
    });
    
    const context = createComponent({ count: 0 });
    const counter = Counter(context);
    
    const { result, unmount } = renderHook(() => useSignal(counter.value));
    
    expect(result.current).toBe(0);
    
    // Unmount the hook
    unmount();
    
    // Update the signal after unmount
    act(() => {
      context.set(context.store.count, 1);
    });
    
    // No error should occur and result should still be 0
    expect(result.current).toBe(0);
  });
});