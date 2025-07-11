/**
 * Type guards for Lattice reactive primitives
 * Uses the __type property for fast, reliable type checking
 */

import type { Signal, Computed, Effect } from './types';

/**
 * Check if a value is a Signal
 */
export function isSignal(value: unknown): value is Signal<unknown> {
  return value != null && 
    typeof value === 'object' && 
    '__type' in value && 
    value.__type === 'signal';
}

/**
 * Check if a value is a Computed
 */
export function isComputed(value: unknown): value is Computed<unknown> {
  return value != null && 
    typeof value === 'object' && 
    '__type' in value && 
    value.__type === 'computed';
}

/**
 * Check if a value is an Effect
 */
export function isEffect(value: unknown): value is Effect {
  return value != null && 
    typeof value === 'object' && 
    '__type' in value && 
    value.__type === 'effect';
}

/**
 * Check if a value is any reactive primitive (Signal, Computed, or Effect)
 */
export function isReactive(value: unknown): value is Signal<unknown> | Computed<unknown> | Effect {
  return isSignal(value) || isComputed(value) || isEffect(value);
}