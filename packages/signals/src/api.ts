// Main API that creates signal functions with shared context using Lattice
import { createContext as createLattice, type LatticeExtension } from '@lattice/lattice';
import { createContext } from './context';

// Type for extension factory functions that accept a context
export type ExtensionFactory<TName extends string, TMethod> = (
  ctx: ReturnType<typeof createContext>
) => LatticeExtension<TName, TMethod>;

// Type helper to extract the API from extension factories
export type FactoriesToAPI<T extends Record<string, ExtensionFactory<string, unknown>>> = {
  [K in keyof T]: T[K] extends ExtensionFactory<string, infer M> ? M : never;
} & { 
  _ctx: ReturnType<typeof createContext>;
  dispose: () => void;
};

// Factory for creating signal APIs with custom primitives
export function createSignalAPI<T extends Record<string, ExtensionFactory<string, unknown>>>(
  factories: T
): FactoriesToAPI<T> {
  // Create the shared signal context
  const signalCtx = createContext();
  
  // Get extensions by calling factories with the context
  const extensions = Object.values(factories).map(factory => factory(signalCtx));
  
  // Create the Lattice context
  const latticeCtx = createLattice(...extensions);
  
  // Build the API by combining Lattice context with signal context
  const api = {
    ...latticeCtx,
    _ctx: signalCtx,
  } as FactoriesToAPI<T>;
  
  return api;
}

// Legacy type for backwards compatibility (can be removed later)
export type SignalFactory<T> = ExtensionFactory<string, T>;

// Type exports for users who want to create custom primitives
export type { SignalContext } from './context';