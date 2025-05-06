/**
 * Common types used throughout the Lattice library
 */

import { type StateCreator, type StoreApi, type UseBoundStore } from 'zustand';

/**
 * A type representing a Zustand store created by the Lattice library
 */
export type Store<T extends object> = UseBoundStore<StoreApi<T>>;

/**
 * A type representing a state creator function for Zustand stores
 */
export type StoreInitializer<T extends object> = StateCreator<T, [], []>;
