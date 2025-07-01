import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { createComponent, type ComponentContext } from '@lattice/core';
import { useSignal } from './react';

describe('React multiple subscriptions test', () => {
  it('should handle multiple simultaneous subscriptions', () => {
    const context = createComponent({ count: 0, name: 'test' });
    const TestComponent = ({ store }: ComponentContext<{ count: number; name: string }>) => ({
      count: store.count,
      name: store.name,
    });
    const component = TestComponent(context);
    
    // Create multiple hooks subscribing to the same signal
    const { result: result1 } = renderHook(() => useSignal(component.count));
    const { result: result2 } = renderHook(() => useSignal(component.count));
    const { result: result3 } = renderHook(() => useSignal(component.count));
    
    expect(result1.current).toBe(0);
    expect(result2.current).toBe(0);
    expect(result3.current).toBe(0);
    
    act(() => {
      context.set(context.store.count, 5);
    });
    
    // All hooks should update
    expect(result1.current).toBe(5);
    expect(result2.current).toBe(5);
    expect(result3.current).toBe(5);
  });
});