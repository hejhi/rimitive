/**
 * Selector tracking and instrumentation
 * 
 * This module provides utilities for tracking selectors in the new functional API
 */

import { SELECTOR_STRING_MAX_LENGTH } from '../constants';

/**
 * Extract a readable string representation of a selector function
 */
export function extractSelectorString<T, R>(selector: (value: T) => R): string {
  const str = selector.toString();
  return str.length > SELECTOR_STRING_MAX_LENGTH
    ? str.substring(0, SELECTOR_STRING_MAX_LENGTH) + '...'
    : str;
}

