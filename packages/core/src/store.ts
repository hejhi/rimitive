import { create } from 'zustand';
import { type StoreInitializer, type Store } from './types';

/**
 * Creates a Zustand store with proper type inference.
 * This is a thin wrapper around Zustand's create function that ensures
 * consistent usage throughout the Lattice library.
 *
 * @param initializer - The state creator function that defines the initial state and actions
 * @returns A Zustand store with the defined state and actions
 */
export function createStore<T extends object>(
  initializer: StoreInitializer<T>
): Store<T> {
  return create<T>(initializer);
}
