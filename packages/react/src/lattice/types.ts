import type { Store } from '@lattice/lattice';

export type StoreFactory<T extends Record<string, unknown>> = () => Store<T>;