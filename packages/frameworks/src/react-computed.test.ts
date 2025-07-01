import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { type ComponentFactory } from '@lattice/core';
import { useComponent, useSignal } from './react';

describe('React computed test', () => {
  it('should work with computed values', () => {
    const Counter: ComponentFactory<{ count: number }> = ({ store, computed, set }) => ({
      value: store.count,
      increment: () => set(store.count, store.count() + 1),
      isEven: computed(() => store.count() % 2 === 0),
    });
    
    const { result } = renderHook(() => 
      useComponent({ count: 0 }, Counter)
    );
    
    expect(result.current.value()).toBe(0);
    expect(result.current.isEven()).toBe(true);
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.value()).toBe(1);
    expect(result.current.isEven()).toBe(false);
  });
  
  it('should subscribe to computed with useSignal', () => {
    const Counter: ComponentFactory<{ count: number }> = ({ store, computed, set }) => ({
      value: store.count,
      increment: () => set(store.count, store.count() + 1),
      isEven: computed(() => store.count() % 2 === 0),
    });
    
    const { result: componentResult } = renderHook(() => 
      useComponent({ count: 0 }, Counter)
    );
    
    const { result: isEvenResult } = renderHook(() => 
      useSignal(componentResult.current.isEven)
    );
    
    expect(isEvenResult.current).toBe(true);
    
    act(() => {
      componentResult.current.increment();
    });
    
    expect(isEvenResult.current).toBe(false);
  });
});