import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { type ComponentFactory } from '@lattice/core';
import { useComponent, useSignal } from './react';

describe('React useComponent test', () => {
  it('should create component', () => {
    const Counter: ComponentFactory<{ count: number }> = ({ store, set }) => ({
      value: store.count,
      increment: () => set(store.count, store.count() + 1),
    });
    
    const { result } = renderHook(() => 
      useComponent({ count: 0 }, Counter)
    );
    
    expect(result.current.value()).toBe(0);
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.value()).toBe(1);
  });
  
  it('should work with useSignal', () => {
    const Counter: ComponentFactory<{ count: number }> = ({ store, set }) => ({
      value: store.count,
      increment: () => set(store.count, store.count() + 1),
    });
    
    const { result: componentResult } = renderHook(() => 
      useComponent({ count: 0 }, Counter)
    );
    
    const { result: signalResult } = renderHook(() => 
      useSignal(componentResult.current.value)
    );
    
    expect(signalResult.current).toBe(0);
    
    act(() => {
      componentResult.current.increment();
    });
    
    expect(signalResult.current).toBe(1);
  });
});