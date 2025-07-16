/**
 * Type guards for Lattice reactive primitives
 */

import type { Signal, Computed, Effect } from '@lattice/core';

/**
 * Check if a value is a Signal
 */
export function isSignal(value: unknown): value is Signal<unknown> {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;

  // Check for __type property first (newer approach)
  if ('__type' in obj && obj.__type === 'signal') return true;

  // Fallback to structure check for compatibility
  return '_value' in obj && '_version' in obj && !('_fn' in obj);
}

/**
 * Check if a value is a Computed
 */
export function isComputed(value: unknown): value is Computed<unknown> {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;

  // Check for __type property first (newer approach)
  if ('__type' in obj && obj.__type === 'computed') return true;

  // Fallback to structure check for compatibility
  return '_fn' in obj && '_value' in obj && '_flags' in obj;
}

/**
 * Check if a value is an Effect
 */
export function isEffect(value: unknown): value is Effect {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;

  // Check for __type property first (newer approach)
  if ('__type' in obj && obj.__type === 'effect') return true;

  // Fallback to structure check for compatibility
  return '_fn' in obj && '_flags' in obj && !('_value' in obj);
}
