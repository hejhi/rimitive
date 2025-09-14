/**
 * ALGORITHM: Composable Factory-Based API Architecture
 * 
 * This module implements a sophisticated factory pattern that enables:
 * 
 * 1. MODULAR COMPOSITION:
 *    - Each reactive primitive (signal, computed, effect) is a separate factory
 *    - Users can import only what they need (tree-shaking)
 *    - Easy to add custom primitives by creating new factories
 *    - Similar to React's hooks philosophy - composable primitives
 * 
 * 2. SHARED CONTEXT PATTERN:
 *    - All primitives share a single GlobalContext instance
 *    - Enables coordination between different primitive types
 *    - Context isolation for SSR/concurrent rendering
 *    - Inspired by React Context and Zone.js
 * 
 * 3. TYPE-SAFE EXTENSIBILITY:
 *    - TypeScript infers the final API shape from factories
 *    - Adding new factories automatically extends the API types
 *    - No need to manually maintain API interface definitions
 *    - Uses advanced TypeScript mapped types and inference
 * 
 * 4. LATTICE INTEGRATION:
 *    - Leverages @lattice/lattice for method composition
 *    - Provides automatic dispose() method for cleanup
 *    - Handles method name conflicts and composition
 *    - Minimal boilerplate for extending the system
 * 
 * DESIGN PHILOSOPHY:
 * - Composition over inheritance
 * - Explicit over implicit
 * - Type safety without runtime overhead
 * - Pay only for what you use
 */
import { createContext as createLattice, type LatticeExtension } from '@lattice/lattice';
import type { GlobalContext } from './context';
// Note: Context is now passed directly to factories
// Each factory can declare its own context requirements

// Type for extension factory functions
export type ExtensionFactory<
  TName extends string,
  TMethod,
  TCtx = GlobalContext
> = (ctx: TCtx) => LatticeExtension<TName, TMethod>;

// Base factory type - we use never to bypass variance checking
// while still extracting the return type correctly
type Factory = (ctx: never) => LatticeExtension<string, unknown>;

// ALGORITHM: Type-Level Factory to API Transformation
// Transforms a record of factories into the final API shape
// For each factory, it extracts the method type and maps it to the same key
// Also adds internal context and dispose method
export type FactoriesToAPI<
  T extends Record<string, Factory>,
  TCtx
> = {
  [K in keyof T]: T[K] extends (ctx: never) => LatticeExtension<string, infer M> ? M : never;
} & {
  _ctx: TCtx;  // Exposed for advanced use cases
  dispose: () => void;  // Cleanup method from Lattice
};

// Helper to extract all required context properties from factories
type ExtractContextRequirements<T extends Record<string, Factory>> =
  T[keyof T] extends (ctx: infer C) => unknown ? (C extends never ? unknown : C) : never;

// ALGORITHM: Modular API Construction
// This function is the main entry point for creating a signals API
// It allows users to pick exactly which primitives they need,
// enabling optimal tree-shaking and extensibility
export function createSignalAPI<
  T extends Record<string, Factory>,
  TCtx extends ExtractContextRequirements<T>
>(
  factories: T,
  ctx: TCtx
): FactoriesToAPI<T, TCtx> {
  // STEP 1: Use provided context
  // Users must provide their own context for full control
  const signalCtx = ctx;

  // STEP 2: Initialize Extensions
  // Call each factory with the context to create extensions
  // Each extension defines one method (signal, computed, effect, etc)
  // We cast to never to bypass TypeScript's variance checking while maintaining runtime safety
  const extensions = Object.values(factories).map(factory => factory(signalCtx as never));

  // STEP 3: Compose with Lattice
  // Lattice handles the method composition and provides dispose functionality
  const latticeCtx = createLattice(...extensions);

  // STEP 4: Build Final API
  // Combine Lattice methods with our signal context
  // The context is exposed as _ctx for advanced use cases
  // TypeScript cannot precisely infer the mapping between factories and
  // composed methods from the dynamic extensions array. We assert the shape
  // here to align with FactoriesToAPI's contract.
  const api = {
    ...(latticeCtx as unknown as Omit<FactoriesToAPI<T, TCtx>, '_ctx'>),
    _ctx: signalCtx,
  } as FactoriesToAPI<T, TCtx>;
  
  return api;
  
  // TODO: Consider adding a development mode with validation
  // Could check for duplicate method names, invalid factories, etc.
}

// Type exports for users who want to create custom primitives
export type { GlobalContext } from './context';
