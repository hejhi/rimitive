// ALGORITHM: Factory-Based API with Shared Context
//
// This module implements a factory pattern that allows users to create
// custom reactive primitives while sharing a single context. The design:
// 1. Each primitive (signal, computed, effect) is a factory function
// 2. All factories receive the same context for coordination
// 3. Uses the Lattice library for extensible method composition
// 4. Enables tree-shaking by only importing needed factories
import { createContext as createLattice, type LatticeExtension } from '@lattice/lattice';
import { createContext } from './context';

// Type for extension factory functions that accept a context
// Each factory creates one reactive primitive (signal, computed, etc)
export type ExtensionFactory<TName extends string, TMethod> = (
  ctx: ReturnType<typeof createContext>
) => LatticeExtension<TName, TMethod>;

// ALGORITHM: Type-Level Factory to API Transformation
// This complex type transforms a record of factories into the final API shape
// For each factory, it extracts the method type and maps it to the same key
// Also adds internal context and dispose method
export type FactoriesToAPI<T extends Record<string, ExtensionFactory<string, unknown>>> = {
  [K in keyof T]: T[K] extends ExtensionFactory<string, infer M> ? M : never;
} & { 
  _ctx: ReturnType<typeof createContext>;  // Exposed for advanced use cases
  dispose: () => void;                      // Cleanup method from Lattice
};

// ALGORITHM: Modular API Construction
// This function is the main entry point for creating a signals API
// It allows users to pick exactly which primitives they need,
// enabling optimal tree-shaking and extensibility
export function createSignalAPI<T extends Record<string, ExtensionFactory<string, unknown>>>(
  factories: T
): FactoriesToAPI<T> {
  // STEP 1: Create Shared Context
  // All reactive primitives share this context for coordination
  // Contains: current consumer, batch depth, scheduling queue, etc.
  const signalCtx = createContext();
  
  // STEP 2: Initialize Extensions
  // Call each factory with the shared context to create extensions
  // Each extension defines one method (signal, computed, effect, etc)
  const extensions = Object.values(factories).map(factory => factory(signalCtx));
  
  // STEP 3: Compose with Lattice
  // Lattice handles the method composition and provides dispose functionality
  const latticeCtx = createLattice(...extensions);
  
  // STEP 4: Build Final API
  // Combine Lattice methods with our signal context
  // The context is exposed as _ctx for advanced use cases
  const api = {
    ...latticeCtx,
    _ctx: signalCtx,
  } as FactoriesToAPI<T>;
  
  return api;
  
  // TODO: Consider adding a development mode with validation
  // Could check for duplicate method names, invalid factories, etc.
}

// Type exports for users who want to create custom primitives
export type { SignalContext } from './context';