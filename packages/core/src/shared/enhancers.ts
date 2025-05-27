/**
 * Core enhancer types and interfaces for Lattice
 */

/**
 * An enhancer provides additional functionality to models, selectors, actions, etc.
 * Each enhancer has a name and a create function that returns the actual tools.
 */
export interface Enhancer<TName extends string = string, TTools = unknown> {
  name: TName;
  create: (context: EnhancerContext) => TTools;
}

/**
 * Context provided to enhancers for creating their tools
 */
export interface EnhancerContext {
  getState: () => unknown;
  setState?: (updates: unknown) => void;
  subscribe?: (listener: () => void) => () => void;
}

/**
 * Extract the tools type from an enhancer
 */
export type EnhancerTools<E> = E extends Enhancer<infer Name, infer Tools>
  ? { [K in Name]: Tools }
  : never;

/**
 * Combine multiple enhancer tools into a single type
 */
export type CombineEnhancerTools<E extends ReadonlyArray<Enhancer>> = 
  E extends readonly [...infer Rest extends ReadonlyArray<Enhancer>, infer Last extends Enhancer]
    ? CombineEnhancerTools<Rest> & EnhancerTools<Last>
    : {};

/**
 * A factory that can have enhancers attached via .with()
 */
export interface WithEnhancers<TFactory, TEnhancers extends ReadonlyArray<Enhancer> = []> {
  with<E extends Enhancer[]>(...enhancers: E): TFactory & WithEnhancers<TFactory, [...TEnhancers, ...E]>;
}

/**
 * Type helper to add .with() method to a factory
 */
export type EnhancedFactory<TFactory, TEnhancers extends ReadonlyArray<Enhancer> = []> = 
  TFactory & WithEnhancers<TFactory, TEnhancers>;

/**
 * Helper to get enhancers from a factory (used internally)
 */
export const ENHANCERS_SYMBOL = Symbol('lattice.enhancers');

/**
 * Helper to attach enhancers to a factory
 */
export function attachEnhancers<TFactory extends object, TEnhancers extends ReadonlyArray<Enhancer>>(
  factory: TFactory,
  enhancers: TEnhancers
): TFactory & WithEnhancers<TFactory, TEnhancers> {
  // Store enhancers in a closure
  const getEnhancers = () => enhancers;
  
  // For functions, we need to preserve the function itself
  const enhanced = Object.assign(factory, {
    with<E extends Enhancer[]>(...newEnhancers: E): TFactory & WithEnhancers<TFactory, [...TEnhancers, ...E]> {
      return attachEnhancers(factory, [...enhancers, ...newEnhancers] as [...TEnhancers, ...E]);
    },
    // Store enhancers getter as a non-enumerable property for internal use
    [ENHANCERS_SYMBOL]: getEnhancers,
  });
  
  return enhanced as TFactory & WithEnhancers<TFactory, TEnhancers>;
}

/**
 * Helper to retrieve enhancers from a factory (used internally)
 */
export function getEnhancers(factory: any): ReadonlyArray<Enhancer> {
  return factory[ENHANCERS_SYMBOL]?.() || [];
}