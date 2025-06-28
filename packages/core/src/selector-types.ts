/**
 * @fileoverview Type definitions for the select API
 * 
 * Provides types for cached selectors that enable O(1) lookups
 * for previously found objects across different predicates.
 */

/**
 * Result returned by a selector function
 * Contains the found value and metadata for updates
 */
export interface SelectorResult<T> {
  readonly __selector: true;
  readonly value: T | undefined;
  readonly signal: any; // Will be Signal<T[]> but avoiding circular dep
  readonly predicate: (item: T, index?: number) => boolean;
}

/**
 * Factory function that creates selector instances
 */
export type SelectorFactory<TArgs extends any[], TResult> = (
  ...args: TArgs
) => SelectorResult<TResult>;

/**
 * Function that creates selector factories
 */
export type SelectFunction = <TArgs extends any[], TResult>(
  selectorFn: (...args: TArgs) => TResult | undefined
) => SelectorFactory<TArgs, TResult>;

/**
 * Metadata stored in WeakMap for cached objects
 */
export interface SelectorMetadata {
  signal: any; // Source signal
  predicate: Function; // Original predicate
  lastAccess: number; // For debugging/profiling
}

/**
 * Type guard for selector results
 */
export function isSelectorResult(value: any): value is SelectorResult<any> {
  return value && typeof value === 'object' && value.__selector === true;
}