/**
 * Import Instance type from shared/types
 */
import type { Instance } from '../shared/types';

/**
 * Type for a model instance, which is a function that returns a slice creator
 * T represents the slice of state this model contributes
 */
export type ModelInstance<T> = Instance<T, 'model'>;
