import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { createComponent, type ComponentContext } from '@lattice/core';
import { useSignal } from './react';

describe('React array mutations test', () => {
  it('should handle array mutations correctly', () => {
    const context = createComponent({ items: [1, 2, 3] });
    
    const ListComponent = ({ store, set }: ComponentContext<{ items: number[] }>) => ({
      items: store.items,
      push: (item: number) => set(store.items, current => [...current, item]),
      remove: (index: number) => set(store.items, current => 
        current.filter((_, i) => i !== index)
      ),
    });
    
    const component = ListComponent(context);
    const { result } = renderHook(() => useSignal(component.items));
    
    expect(result.current).toEqual([1, 2, 3]);
    
    act(() => {
      component.push(4);
    });
    
    expect(result.current).toEqual([1, 2, 3, 4]);
    
    act(() => {
      component.remove(1);
    });
    
    expect(result.current).toEqual([1, 3, 4]);
  });
});