// Main API that creates signal functions with shared context
// IMPORTANT: Don't import factories here - that defeats tree-shaking!
import { createContext } from './context';

// Type for factory functions that accept a context
export type SignalFactory<T> = (ctx: ReturnType<typeof createContext>) => T;

// Type helper to extract the return types from factories
export type FactoriesToAPI<T extends Record<string, SignalFactory<unknown>>> = {
  [K in keyof T]: ReturnType<T[K]>;
} & { _ctx: ReturnType<typeof createContext> };

// Factory for creating signal APIs with custom primitives
export function createSignalAPI<T extends Record<string, SignalFactory<unknown>>>(
  factories: T
): FactoriesToAPI<T> {
  const ctx = createContext();
  const api = { _ctx: ctx } as FactoriesToAPI<T>;
  
  // Build API by calling each factory with the context
  for (const [name, factory] of Object.entries(factories)) {
    api[name as keyof T] = factory(ctx) as FactoriesToAPI<T>[keyof T];
  }
  
  return api;
}

// Re-export just the context creator for truly modular usage
export { createContext };

// Note: For backwards compatibility and convenience, we'll keep a default-api.ts file
// that provides the lazy-loaded defaults. This file (api.ts) is purely for the
// tree-shakeable factory pattern.

// Type exports for users who want to create custom primitives
export type { SignalContext } from './context';