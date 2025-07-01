import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { createComponent } from '@lattice/core';
import { useSignal } from './react';

describe('Simple React hook test', () => {
  it('should use signal', () => {
    const context = createComponent({ count: 0 });
    
    const { result } = renderHook(() => useSignal(context.store.count));
    
    expect(result.current).toBe(0);
    
    act(() => {
      context.set(context.store.count, 1);
    });
    
    expect(result.current).toBe(1);
  });
});