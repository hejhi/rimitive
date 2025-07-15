/**
 * Selector tracking and instrumentation
 * 
 * This module handles the wrapping and tracking of selector methods
 * on signals and computed values.
 */

import type { Signal, Computed } from '@lattice/core';
import { SELECTOR_STRING_MAX_LENGTH } from '../constants';
import { executionContext } from './execution-context';
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
 */
export function wrapSelectMethod<T extends Signal<unknown> | Computed<unknown>>(
  source: T,
  sourceTracked: TrackedPrimitive & { ref: T },
  options: SelectorWrapperOptions
): void {
  const originalSelect = source.select;
  if (!originalSelect) return;

  // Create properly typed wrapper
  const wrappedSelect = function <R>(
    this: T,
    selector: (value: T extends Signal<infer U> ? U : T extends Computed<infer U> ? U : never) => R
  ) {
    // Call original select method
    const selected = originalSelect.call(this, selector as Parameters<typeof originalSelect>[0]);
    
    // Extract selector string for debugging
    const selectorString = extractSelectorString(selector);
    
    // Register the selector
    const trackedSelector = options.registry.registerSelector(
      sourceTracked.id,
      selectorString,
      options.contextId,
      selected
    );
    
    // Emit creation event
    options.eventEmitter.emit({
      type: 'SELECTOR_CREATED',
      contextId: options.contextId,
      timestamp: Date.now(),
      data: {
        id: trackedSelector.id,
        sourceId: sourceTracked.id,
        sourceName: sourceTracked.name,
        sourceType: sourceTracked.type as 'signal' | 'computed',
        selector: selectorString,
      },
    });
    
    // Instrument the selector value getter if read tracking is enabled
    if (options.trackReads) {
      instrumentSelectorReads(selected, trackedSelector.id, selectorString, options);
    }
    
    return selected;
  };
  
  // Replace the select method
  Object.defineProperty(source, 'select', {
    value: wrappedSelect,
    writable: true,
    enumerable: false,
    configurable: true
  });
}

/**
 * Instrument selector reads for tracking
 */
function instrumentSelectorReads(
  selected: unknown,
  selectorId: string,
  selectorString: string,
  options: Pick<SelectorWrapperOptions, 'contextId' | 'eventEmitter'>
): void {
  const descriptor = Object.getOwnPropertyDescriptor(selected, 'value');
  if (!descriptor?.get) return;

  // Store original getter
  const originalGetter = descriptor.get.bind(selected);
  
  Object.defineProperty(selected, 'value', {
    get() {
      const value = originalGetter() as unknown;
      
      // Only emit read events if we're in an execution context
      const currentContext = executionContext.current;
      if (currentContext) {
        options.eventEmitter.emit({
          type: 'SIGNAL_READ',
          contextId: options.contextId,
          timestamp: Date.now(),
          data: {
            id: selectorId,
            name: selectorString,
            value,
            internal: false,
            executionContext: currentContext,
            readContext: {
              type: 'selector',
              id: selectorId,
              name: selectorString,
            },
          },
        });
      }
      
      return value;
    },
    enumerable: false,
    configurable: true,
  });
}