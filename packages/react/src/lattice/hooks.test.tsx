import { describe, it, expect, vi } from 'vitest';
import { act } from '@testing-library/react';
import { createStore } from './store';
import { useStore } from './hooks';
import { renderHookWithLattice } from '../testing';

describe('Core Hooks', () => {
  describe('useStore', () => {
    it('should create and manage store lifecycle', () => {
      const disposeSpy = vi.fn();
      const storeFactory = () => {
        const store = createStore({ count: 0 });
        const originalDispose = store.dispose.bind(store);
        store.dispose = () => {
          disposeSpy();
          originalDispose();
        };
        return store;
      };

      const { result, unmount } = renderHookWithLattice(() =>
        useStore(storeFactory)
      );

      expect(result.current.state.count.value).toBe(0);
      expect(disposeSpy).not.toHaveBeenCalled();

      unmount();

      expect(disposeSpy).toHaveBeenCalledOnce();
    });

    it('should only create store once per component instance', () => {
      const factorySpy = vi.fn(() => createStore({ value: 'test' }));

      const { result, rerender } = renderHookWithLattice(() =>
        useStore(factorySpy)
      );

      const firstStore = result.current;
      const initialCallCount = factorySpy.mock.calls.length;

      // Multiple rerenders should not create new stores
      rerender();
      rerender();

      expect(result.current).toBe(firstStore);
      expect(factorySpy.mock.calls.length).toBe(initialCallCount);
    });

    it('should allow store mutations', () => {
      const { result } = renderHookWithLattice(() =>
        useStore(() => createStore({ count: 0 }))
      );

      expect(result.current.state.count.value).toBe(0);

      act(() => {
        result.current.state.count.value = 10;
      });

      expect(result.current.state.count.value).toBe(10);

      act(() => {
        result.current.set({ count: 20 });
      });

      expect(result.current.state.count.value).toBe(20);
    });
  });
});