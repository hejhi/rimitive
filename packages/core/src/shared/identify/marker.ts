import { Branded } from '../types';

/**
 * Generic function to check if a given value is a valid Lattice object
 *
 * @param value The value to check
 * @param marker The marker symbol to check for
 * @returns Whether the value is a valid Lattice object
 */
export function isBranded<M extends symbol>(
  value: unknown,
  marker: M
): boolean {
  return (
    (typeof value === 'function' || typeof value === 'object') &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, marker) &&
    Boolean(Reflect.get(value, marker))
  );
}

/**
 * Generic function to brand any value with a specific symbol
 *
 * @param value The value to brand
 * @param symbol The symbol to use for branding
 * @returns The branded value
 */
export function brandWithSymbol<T, M extends symbol>(
  value: T,
  symbol: M
): Branded<T, M> {
  // Check if already branded to make it idempotent
  if (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, symbol) &&
    Boolean(Reflect.get(value, symbol))
  ) {
    return value as Branded<T, M>;
  }

  // We need a single type assertion here to add the symbol property
  Object.defineProperty(value, symbol, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return value as Branded<T, M>;
}
