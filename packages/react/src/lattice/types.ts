import type { Store } from './store';

export type StoreFactory<T extends Record<string, unknown>> = () => Store<T>;