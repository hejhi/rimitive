/**
 * Reactive template literal helper
 *
 * Creates a computed that interpolates signals/computeds in a template string.
 * Designed for use as el() children.
 */

import { Readable } from 'src/types';

/**
 * Create a reactive template literal tag function
 *
 * @param computed - The computed function from signals service
 * @returns A tagged template function that creates reactive text
 */
export function createText(computed: <T>(fn: () => T) => Readable<T>) {
  return (strings: TemplateStringsArray, ...values: unknown[]) =>
    computed(() => {
      let result = strings[0] ?? '';
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        // Call if function (signal/computed), otherwise use directly
        const resolved = typeof value === 'function' ? value() : value;
        result += String(resolved ?? '') + (strings[i + 1] ?? '');
      }
      return result;
    });
}
