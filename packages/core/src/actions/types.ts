/**
 * Re-export shared types
 */
import type { Instance } from '../shared/types';

/**
 * Type for an action instance, which is a function that returns a slice creator
 * T represents the set of actions this instance contributes
 */
export type ActionInstance<T> = Instance<T, 'actions'>;
