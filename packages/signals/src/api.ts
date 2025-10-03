import { createContext as createLattice, type LatticeExtension } from '@lattice/lattice';
import type { GlobalContext } from './context';

export type ExtensionFactory<
  TName extends string,
  TMethod,
  TCtx = GlobalContext
> = (ctx: TCtx) => LatticeExtension<TName, TMethod>;

type Factory = (ctx: never) => LatticeExtension<string, unknown>;

export type FactoriesToAPI<
  T extends Record<string, Factory>,
> = {
  [K in keyof T]: T[K] extends (ctx: never) => LatticeExtension<string, infer M> ? M : never;
} & {
  dispose: () => void;  // Cleanup method from Lattice
};

// Helper to extract all required context properties from factories
type ExtractContextRequirements<T extends Record<string, Factory>> =
  T[keyof T] extends (ctx: infer C) => unknown ? (C extends never ? unknown : C) : never;

export function createSignalAPI<
  T extends Record<string, Factory>,
  TCtx extends ExtractContextRequirements<T>
>(
  factories: T,
  ctx: TCtx
): FactoriesToAPI<T> {
  const extensions = Object.values(factories).map((factory) =>
    factory(ctx as never)
  );
  
  return {
    ...createLattice(...extensions),
  } as FactoriesToAPI<T>;
}

// Type exports for users who want to create custom primitives
export type { GlobalContext } from './context';
