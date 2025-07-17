import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createStore, createLattice } from '@lattice/core';
import {
  useLattice,
  useStore,
  useStoreContext,
} from './hooks';
import { LatticeProvider, StoreProvider } from './components';
import { renderHookWithLattice } from '../testing';
import React from 'react';

describe('Core Hooks', () => {
  describe('useLattice', () => {
    it('should throw error when used outside provider', () => {
      const { result } = renderHook(() => {
        try {
          return useLattice();
        } catch (error) {
          return error;
        }
      });

      expect(result.current).toBeInstanceOf(Error);
      expect((result.current as Error).message).toContain('LatticeProvider');
    });

    it('should return lattice context from provider', () => {
      const customLattice = createLattice();
      const { result } = renderHook(() => useLattice(), {
        wrapper: ({ children }) => (
          <LatticeProvider context={customLattice}>{children}</LatticeProvider>
        ),
      });

      expect(result.current).toBe(customLattice);
    });

    it('should create signals in the provided context', () => {
      const { result } = renderHookWithLattice(() => {
        const lattice = useLattice();
        const sig = lattice.signal(42);
        return sig;
      });

      expect(result.current.value).toBe(42);
    });
  });

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

  describe('useStoreContext', () => {
    it('should throw error when used outside provider', () => {
      const { result } = renderHook(() => {
        try {
          return useStoreContext();
        } catch (error) {
          return error;
        }
      });

      expect(result.current).toBeInstanceOf(Error);
      expect((result.current as Error).message).toContain('StoreProvider');
    });

    it('should return store from provider', () => {
      const store = createStore({ test: 'value' });

      const { result } = renderHook(() => useStoreContext(), {
        wrapper: ({ children }) => (
          <StoreProvider store={store}>{children}</StoreProvider>
        ),
      });

      expect(result.current).toBe(store);
    });
  });

});
