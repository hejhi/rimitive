import type { ReactNode } from 'react';
import type {
  Store,
  LatticeContext as BaseLatticeContext,
} from '@lattice/lattice';

export interface LatticeProviderProps {
  children: ReactNode;
  context?: BaseLatticeContext;
}

export interface StoreProviderProps<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  store: Store<T>;
  children: ReactNode;
}

export type StoreFactory<T extends Record<string, unknown>> = () => Store<T>;

export type StoreSelector<T extends Record<string, unknown>, R> = (
  state: T
) => R;
