import { describe, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createComponent, type ComponentFactory } from '@lattice/core';
import { useSignal } from './react';

describe('Isolated hanging test from react.test.ts', () => {
  // This is the exact Counter factory from the original test
  const Counter: ComponentFactory<{ count: number }> = ({
    store,
    computed,
    set,
  }) => ({
    value: store.count,
    increment: () => set(store.count, (count) => count + 1),
    isEven: computed(() => store.count() % 2 === 0),
  });

  it('should hang', () => {
    const context = createComponent({ count: 0 });
    const counter = Counter(context);

    renderHook(() => {
      useSignal(counter.isEven);
    });

    // once called, the test will hang. has something to do with useSignal in renderHook.
    counter.increment();
  });
});