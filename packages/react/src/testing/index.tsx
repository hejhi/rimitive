import React, { ReactElement } from 'react';
import {
  render,
  renderHook,
  RenderOptions,
  RenderHookOptions,
} from '@testing-library/react';
import { createStore } from '@lattice/lattice';
import type { Store } from '@lattice/lattice';

type CustomRenderOptions = Omit<RenderOptions, 'wrapper'>;
type CustomRenderHookOptions<Props> = Omit<RenderHookOptions<Props>, 'wrapper'>;

/**
 * Creates a wrapper component for testing.
 * This provides a stable testing environment for Lattice hooks.
 *
 * @example
 * ```tsx
 * const wrapper = createLatticeWrapper();
 * const { result } = renderHook(() => useSignal(0), { wrapper });
 * ```
 */
export function createLatticeWrapper() {
  // Simple wrapper component for consistent test environment
  return function LatticeWrapper({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
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
  const { ...renderOptions } = options;
  const Wrapper = createLatticeWrapper();

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Render a hook with Lattice context for testing.
 * This is a wrapper around @testing-library/react's renderHook function.
 *
 * @example
 * ```tsx
 * test('useSignal updates', () => {
 *   const { result } = renderHookWithLattice(() => useSignal(0));
 *   expect(result.current[0]).toBe(0);
 *
 *   act(() => {
 *     result.current[1](1);
 *   });
 *
 *   expect(result.current[0]).toBe(1);
 * });
 * ```
 */
export function renderHookWithLattice<Result, Props>(
  hook: (props: Props) => Result,
  options?: CustomRenderHookOptions<Props>
): ReturnType<typeof renderHook<Result, Props>> {
  const { ...renderOptions } = options ?? {};
  const Wrapper = createLatticeWrapper();

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
 *     () => useSubscribe(store.state.count)
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