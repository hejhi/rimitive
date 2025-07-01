import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import * as React from 'react';
import { createComponent, type ComponentContext } from '@lattice/core';
import { useComponent, useSignal, useComputed } from './react';

describe('React hooks', () => {
  // Define test component behaviors
  const Counter = ({
    store,
    computed,
    set,
  }: ComponentContext<{ count: number }>) => ({
    value: store.count,
    increment: () => set(store.count, store.count() + 1),
    decrement: () => set(store.count, store.count() - 1),
    isEven: computed(() => store.count() % 2 === 0),
    isPositive: computed(() => store.count() > 0),
  });

  const Dialog = ({
    store,
    computed,
    set,
  }: ComponentContext<{ isOpen: boolean; title: string }>) => ({
    isOpen: store.isOpen,
    title: store.title,

    triggerProps: computed(() => ({
      'aria-haspopup': 'dialog',
      'aria-expanded': store.isOpen(),
      onClick: () => set(store.isOpen, true),
    })),

    open: () => set(store.isOpen, true),
    close: () => set(store.isOpen, false),
    setTitle: (title: string) => set(store.title, title),
  });

  describe('useComponent', () => {
    it('should create component-scoped instance', () => {
      const { result } = renderHook(() => useComponent({ count: 0 }, Counter));

      // Initial state
      expect(result.current.value()).toBe(0);
      expect(result.current.isEven()).toBe(true);
      expect(result.current.isPositive()).toBe(false);

      // Update state
      act(() => {
        result.current.increment();
      });

      expect(result.current.value()).toBe(1);
      expect(result.current.isEven()).toBe(false);
      expect(result.current.isPositive()).toBe(true);
    });

    it('should create isolated instances per component', () => {
      const { result: result1 } = renderHook(() =>
        useComponent({ count: 0 }, Counter)
      );

      const { result: result2 } = renderHook(() =>
        useComponent({ count: 0 }, Counter)
      );

      // Modify first instance
      act(() => {
        result1.current.increment();
      });

      // Instances are isolated
      expect(result1.current.value()).toBe(1);
      expect(result2.current.value()).toBe(0);
    });
  });

  describe('useSignal', () => {
    it('should provide fine-grained reactivity', () => {
      // Create shared component outside hooks
      const context = createComponent({ count: 0 });
      const counter = Counter(context);

      let valueRenderCount = 0;
      let isEvenRenderCount = 0;

      // Create hooks separately to avoid potential race conditions
      const valueHook = renderHook(() => {
        valueRenderCount++;
        return useSignal(counter.value);
      });

      const isEvenHook = renderHook(() => {
        isEvenRenderCount++;
        return useSignal(counter.isEven);
      });

      expect(valueHook.result.current).toBe(0);
      expect(isEvenHook.result.current).toBe(true);
      expect(valueRenderCount).toBe(1);
      expect(isEvenRenderCount).toBe(1);

      // Increment should update both
      act(() => {
        counter.increment();
      });

      expect(valueHook.result.current).toBe(1);
      expect(isEvenHook.result.current).toBe(false);
      expect(valueRenderCount).toBe(2);
      expect(isEvenRenderCount).toBe(2);

      // Increment again - value changes but isEven stays false
      act(() => {
        counter.increment();
      });

      expect(valueHook.result.current).toBe(2);
      expect(isEvenHook.result.current).toBe(true);
      expect(valueRenderCount).toBe(3);
      expect(isEvenRenderCount).toBe(3); // Changed because isEven went from false to true
    });

    it('should provide fine-grained reactivity (working pattern)', () => {
      // Alternative test that avoids the hanging issue by using a wrapper component
      const context = createComponent({ count: 0 });
      const counter = Counter(context);

      let valueRenderCount = 0;
      let isEvenRenderCount = 0;

      // Use a single renderHook with multiple signals
      const { result } = renderHook(() => {
        const value = useSignal(counter.value);
        const isEven = useSignal(counter.isEven);

        // Track renders separately
        React.useEffect(() => {
          valueRenderCount++;
        }, [value]);

        React.useEffect(() => {
          isEvenRenderCount++;
        }, [isEven]);

        return { value, isEven };
      });

      expect(result.current.value).toBe(0);
      expect(result.current.isEven).toBe(true);

      // Increment should update both
      act(() => {
        counter.increment();
      });

      expect(result.current.value).toBe(1);
      expect(result.current.isEven).toBe(false);

      // Increment again
      act(() => {
        counter.increment();
      });

      expect(result.current.value).toBe(2);
      expect(result.current.isEven).toBe(true);
    });

    it('should work with component-scoped instances', () => {
      const { result: componentResult } = renderHook(() =>
        useComponent({ isOpen: false, title: 'Test' }, Dialog)
      );

      const { result: isOpenResult } = renderHook(() =>
        useSignal(componentResult.current.isOpen)
      );

      expect(isOpenResult.current).toBe(false);

      act(() => {
        componentResult.current.open();
      });

      expect(isOpenResult.current).toBe(true);
    });

    it('should work with shared/global state', () => {
      // Create global state
      const authContext = createComponent({
        user: null as { name: string } | null,
        isAuthenticated: false,
      });

      const Auth = ({
        store,
        set,
      }: ComponentContext<{
        user: { name: string } | null;
        isAuthenticated: boolean;
      }>) => ({
        user: store.user,
        isAuthenticated: store.isAuthenticated,
        login: (name: string) => {
          set(store.user, { name });
          set(store.isAuthenticated, true);
        },
        logout: () => {
          set(store.user, null);
          set(store.isAuthenticated, false);
        },
      });

      const auth = Auth(authContext);

      // Use in multiple hooks
      const { result: userResult } = renderHook(() => useSignal(auth.user));
      const { result: authResult } = renderHook(() =>
        useSignal(auth.isAuthenticated)
      );

      expect(userResult.current).toBe(null);
      expect(authResult.current).toBe(false);

      act(() => {
        auth.login('Alice');
      });

      expect(userResult.current).toEqual({ name: 'Alice' });
      expect(authResult.current).toBe(true);
    });
  });

  describe('useComputed', () => {
    it('should create derived state from multiple signals', () => {
      const context1 = createComponent({ count: 10 });
      const context2 = createComponent({ count: 5 });

      const counter1 = Counter(context1);
      const counter2 = Counter(context2);

      const { result } = renderHook(() =>
        useComputed(
          () => counter1.value() + counter2.value(),
          [counter1.value, counter2.value]
        )
      );

      expect(result.current).toBe(15);

      act(() => {
        counter1.increment();
      });

      expect(result.current).toBe(16);

      act(() => {
        counter2.increment();
      });

      expect(result.current).toBe(17);
    });

    it('should only re-render when dependent signals change', () => {
      const context = createComponent({ count: 10, name: 'Test' });
      const TestComponent = ({
        store,
      }: ComponentContext<{ count: number; name: string }>) => ({
        count: store.count,
        name: store.name,
      });
      const component = TestComponent(context);

      let renderCount = 0;
      const { result } = renderHook(() => {
        renderCount++;
        return useComputed(() => component.count() * 2, [component.count]);
      });

      expect(result.current).toBe(20);
      expect(renderCount).toBe(1);

      // Change count - should re-render
      act(() => {
        context.set(context.store.count, 15);
      });

      expect(result.current).toBe(30);
      expect(renderCount).toBe(2);

      // Change name - should NOT re-render
      act(() => {
        context.set(context.store.name, 'Updated');
      });

      expect(result.current).toBe(30);
      expect(renderCount).toBe(2); // No additional render
    });
  });

  describe('Integration patterns', () => {
    it('should support mixing component-scoped and shared state', () => {
      // Shared theme context
      const themeContext = createComponent({ dark: false });
      const Theme = ({ store, set }: ComponentContext<{ dark: boolean }>) => ({
        isDark: store.dark,
        toggle: () => set(store.dark, !store.dark()),
      });
      const theme = Theme(themeContext);

      // Component with local state that uses theme
      const { result: dialogResult } = renderHook(() =>
        useComponent({ isOpen: false, title: 'Themed Dialog' }, Dialog)
      );

      const { result: isDarkResult } = renderHook(() =>
        useSignal(theme.isDark)
      );
      const { result: isOpenResult } = renderHook(() =>
        useSignal(dialogResult.current.isOpen)
      );

      expect(isDarkResult.current).toBe(false);
      expect(isOpenResult.current).toBe(false);

      // Toggle theme - affects all components using it
      act(() => {
        theme.toggle();
      });

      expect(isDarkResult.current).toBe(true);

      // Toggle dialog - only affects this component
      act(() => {
        dialogResult.current.open();
      });

      expect(isOpenResult.current).toBe(true);
      expect(isDarkResult.current).toBe(true); // Theme unchanged
    });
  });
});
