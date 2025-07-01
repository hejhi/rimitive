import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { createComponent, type ComponentContext } from '@lattice/core';
import { useSignal } from './react';

describe('React nested computed test (fixed)', () => {
  it('should handle computed values that depend on other computed values', () => {
    const context = createComponent({ count: 0 });
    const AdvancedCounter = ({ store, computed }: ComponentContext<{ count: number }>) => {
      const doubled = computed(() => store.count() * 2);
      const quadrupled = computed(() => doubled() * 2);
      
      return {
        count: store.count,
        doubled,
        quadrupled,
      };
    };
    
    const counter = AdvancedCounter(context);
    
    const { result } = renderHook(() => useSignal(counter.quadrupled));
    
    expect(result.current).toBe(0);
    
    act(() => {
      context.set(context.store.count, 5);
    });
    
    expect(result.current).toBe(20); // 5 * 2 * 2
  });

  it('should handle deeply nested computed values', () => {
    const context = createComponent({ value: 2 });
    const DeeplyNested = ({ store, computed }: ComponentContext<{ value: number }>) => {
      const level1 = computed(() => store.value() + 1);
      const level2 = computed(() => level1() * 2);
      const level3 = computed(() => level2() + 10);
      const level4 = computed(() => level3() * 3);
      
      return {
        value: store.value,
        level1,
        level2,
        level3,
        level4,
      };
    };
    
    const component = DeeplyNested(context);
    
    const { result } = renderHook(() => useSignal(component.level4));
    
    expect(result.current).toBe(48); // ((2 + 1) * 2 + 10) * 3
    
    act(() => {
      context.set(context.store.value, 3);
    });
    
    expect(result.current).toBe(54); // ((3 + 1) * 2 + 10) * 3
  });

  it('should handle multiple nested computed chains', () => {
    const context = createComponent({ a: 1, b: 2 });
    const MultiChain = ({ store, computed }: ComponentContext<{ a: number; b: number }>) => {
      // Chain 1: depends on 'a'
      const doubleA = computed(() => store.a() * 2);
      const tripleDoubleA = computed(() => doubleA() * 3);
      
      // Chain 2: depends on 'b'
      const squareB = computed(() => store.b() * store.b());
      const sqrtSquareB = computed(() => Math.sqrt(squareB()));
      
      // Combined: depends on both chains
      const combined = computed(() => tripleDoubleA() + sqrtSquareB());
      
      return {
        a: store.a,
        b: store.b,
        doubleA,
        tripleDoubleA,
        squareB,
        sqrtSquareB,
        combined,
      };
    };
    
    const component = MultiChain(context);
    
    const { result } = renderHook(() => useSignal(component.combined));
    
    expect(result.current).toBe(8); // (1 * 2 * 3) + sqrt(2 * 2) = 6 + 2
    
    act(() => {
      context.set(context.store.a, 2);
    });
    
    expect(result.current).toBe(14); // (2 * 2 * 3) + sqrt(2 * 2) = 12 + 2
    
    act(() => {
      context.set(context.store.b, 3);
    });
    
    expect(result.current).toBe(15); // (2 * 2 * 3) + sqrt(3 * 3) = 12 + 3
  });
});