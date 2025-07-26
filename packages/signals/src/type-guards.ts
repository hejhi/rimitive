/**
 * Type guards for Lattice reactive primitives
 * Uses the __type property for fast, reliable type checking
 */

import type { Signal, Computed, Effect, SignalLike } from './types';

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
 * Check if a value is an effect dispose function
 */
export function isEffectDisposer(value: unknown): value is import('./types').EffectDisposer {
  return value != null &&
    typeof value === 'function' &&
    '__effect' in value &&
    isEffect(value.__effect);
}

/**
 * Get the Effect instance from a dispose function
 */
export function getEffectFromDisposer(disposer: import('./types').EffectDisposer): Effect {
  return disposer.__effect;
}

/**
 * Check if a value is any reactive primitive (Signal, Computed, or Effect)
 */
export function isReactive(value: unknown): value is Signal<unknown> | Computed<unknown> | Effect {
  return isSignal(value) || isComputed(value) || isEffect(value);
}

/**
 * Check if a value is subscribable (has value property and __type)
 */
export function isSignalLike(value: unknown): value is SignalLike {
  return value != null && 
    typeof value === 'object' && 
    'value' in value &&
    '__type' in value &&
    typeof value.__type === 'string';
}