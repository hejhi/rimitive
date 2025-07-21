/**
 * Selector tracking and instrumentation
 * 
 * This module handles the wrapping and tracking of selector methods
 * on signals and computed values.
 */

import type { Signal, Computed } from '@lattice/signals';
import { SELECTOR_STRING_MAX_LENGTH } from '../constants';
import type { TrackedPrimitive, PrimitiveRegistry } from './registry';
import type { EventEmitter } from '../events/emitter';

/**
 * Options for selector wrapping
 */
export interface SelectorWrapperOptions {
  contextId: string;
  registry: PrimitiveRegistry;
  eventEmitter: EventEmitter;
  trackReads?: boolean;
}

/**
 * Extract a readable string representation of a selector function
 */
export function extractSelectorString<T, R>(selector: (value: T) => R): string {
  const str = selector.toString();
  return str.length > SELECTOR_STRING_MAX_LENGTH
    ? str.substring(0, SELECTOR_STRING_MAX_LENGTH) + '...'
    : str;
}

/**
 * Wrap the select method on a signal or computed to track selector creation
 * @deprecated Select is no longer a method on signals/computed in the new architecture
 */
export function wrapSelectMethod<T extends Signal<unknown> | Computed<unknown>>(
  _source: T,
  _sourceTracked: TrackedPrimitive & { ref: T },
  _options: SelectorWrapperOptions
): void {
  // No-op: select is no longer a method on signals/computed
  // This function is kept for backwards compatibility but does nothing
}

