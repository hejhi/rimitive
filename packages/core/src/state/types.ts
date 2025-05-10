/**
 * Import Instance type from shared/types
 */
import type { Instance } from '../shared/types';

/**
 * Type for a state instance, which is a function that returns a slice creator
 * T represents the slice of state this state contributes
 */
export type StateInstance<T> = Instance<T, 'state'>;
