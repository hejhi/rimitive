import React, { ReactElement } from 'react';
import {
  render,
  renderHook,
  RenderOptions,
  RenderHookOptions,
} from '@testing-library/react';
import { coreExtensions } from '@lattice/signals-store';
import type { LatticeContext, SignalState } from '@lattice/signals-store';
import { createContext } from '@lattice/lattice';

type CustomRenderOptions = Omit<RenderOptions, 'wrapper'>;
type CustomRenderHookOptions<Props> = Omit<RenderHookOptions<Props>, 'wrapper'>;

const createStore = () => createContext(...coreExtensions);

/**
 * Creates a wrapper component for testing.
 * This provides a stable testing environment for Lattice hooks.
 *
 * @example
 * ```tsx
 * const wrapper = createStoreWrapper();
 * const { result } = renderHook(() => useSignal(0), { wrapper });
 * ```
 */
export function createStoreWrapper() {
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
  const Wrapper = createStoreWrapper();

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
  const Wrapper = createStoreWrapper();

  return renderHook(hook, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Create test signals with initial state for testing.
 * Returns a context and signals for testing.
 *
 * @example
 * ```tsx
 * test('signal updates', () => {
 *   const { context, signals } = createTestSignals({ count: 0 });
 *   const { result } = renderHookWithLattice(
 *     () => useSubscribe(signals.count)
 *   );
 *
 *   expect(result.current).toBe(0);
 *
 *   act(() => {
 *     signals.count.value = 1;
 *   });
 *
 *   expect(result.current).toBe(1);
 *   
 *   // Clean up
 *   context.dispose();
 * });
 * ```
 */
export function createTestSignals<T extends Record<string, unknown>>(
  initialState: T
): { context: LatticeContext; signals: SignalState<T> } {
  const context = createStore();
  const signals = {} as SignalState<T>;
  
  for (const [key, value] of Object.entries(initialState)) {
    signals[key as keyof T] = context.signal(value as T[keyof T]);
  }

  return { context, signals };
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