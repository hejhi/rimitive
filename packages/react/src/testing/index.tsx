import React, { ReactElement } from 'react';
import {
  render,
  renderHook,
  RenderOptions,
  RenderHookOptions,
} from '@testing-library/react';
import { createLattice, createStore } from '@lattice/core';
import type { Store, LatticeContext } from '@lattice/core';
import { LatticeProvider, StoreProvider } from '../core';

interface LatticeTestingOptions {
  latticeContext?: LatticeContext;
  store?: Store<Record<string, unknown>>;
}

interface CustomRenderOptions
  extends Omit<RenderOptions, 'wrapper'>,
    LatticeTestingOptions {}
interface CustomRenderHookOptions<Props>
  extends Omit<RenderHookOptions<Props>, 'wrapper'>,
    LatticeTestingOptions {}

/**
 * Creates a wrapper component that provides Lattice context for testing.
 *
 * @example
 * ```tsx
 * const wrapper = createLatticeWrapper();
 * const { result } = renderHook(() => useSubscribe(mySignal), { wrapper });
 * ```
 */
export function createLatticeWrapper(options: LatticeTestingOptions = {}) {
  return function LatticeWrapper({ children }: { children: React.ReactNode }) {
    const lattice = options.latticeContext ?? createLattice();

    if (options.store) {
      return (
        <LatticeProvider context={lattice}>
          <StoreProvider store={options.store}>{children}</StoreProvider>
        </LatticeProvider>
      );
    }

    return <LatticeProvider context={lattice}>{children}</LatticeProvider>;
  };
}

/**
 * Render a component with Lattice context for testing.
 * This is a wrapper around @testing-library/react's render function.
 *
 * @example
 * ```tsx
 * test('renders with signal', () => {
 *   const { getByText } = renderWithLattice(<MyComponent />);
 *   expect(getByText('Hello')).toBeInTheDocument();
 * });
 * ```
 */
export function renderWithLattice(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): ReturnType<typeof render> {
  const { latticeContext, store, ...renderOptions } = options;
  const Wrapper = createLatticeWrapper({ latticeContext, store });

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Render a hook with Lattice context for testing.
 * This is a wrapper around @testing-library/react's renderHook function.
 *
 * @example
 * ```tsx
 * test('useSignal updates', () => {
 *   const count = signal(0);
 *   const { result } = renderHookWithLattice(() => useSubscribe(count));
 *   expect(result.current).toBe(0);
 *
 *   act(() => {
 *     count.value = 1;
 *   });
 *
 *   expect(result.current).toBe(1);
 * });
 * ```
 */
export function renderHookWithLattice<Result, Props>(
  hook: (props: Props) => Result,
  options?: CustomRenderHookOptions<Props>
): ReturnType<typeof renderHook<Result, Props>> {
  const { latticeContext, store, ...renderOptions } = options ?? {};
  const Wrapper = createLatticeWrapper({ latticeContext, store });

  return renderHook(hook, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Create a test store with initial state for testing.
 * The store is automatically bound to a test Lattice context.
 *
 * @example
 * ```tsx
 * test('store updates', () => {
 *   const store = createTestStore({ count: 0 });
 *   const { result } = renderHookWithLattice(
 *     () => useSubscribe(store.state.count),
 *     { store }
 *   );
 *
 *   expect(result.current).toBe(0);
 *
 *   act(() => {
 *     store.state.count.value = 1;
 *   });
 *
 *   expect(result.current).toBe(1);
 * });
 * ```
 */
export function createTestStore<T extends Record<string, unknown>>(
  initialState: T
): Store<T> {
  // For testing, we just create a store with its own context
  // This provides proper isolation for tests
  const store = createStore(initialState);

  return store;
}

/**
 * Clean up all Lattice contexts and stores after tests.
 * This should be called in afterEach to prevent memory leaks.
 *
 * @example
 * ```tsx
 * afterEach(() => {
 *   cleanupLattice();
 * });
 * ```
 */
export function cleanupLattice() {
  // This is handled automatically by React Testing Library's cleanup
  // but we export it for explicit cleanup if needed
}
