// Core exports without testing utilities
export { memoizeParameterizedView, type MemoizeOptions } from './utils/memoize';
export {
  type StoreAdapter,
  type AdapterFactory,
  isStoreAdapter,
  isAdapterFactory,
} from './adapter-contract';
// Export subscription types
export type SubscribableStore = {
  subscribe: (listener: () => void) => () => void;
};
export { createLatticeStore } from './runtime';
export type { ReactiveSliceFactory, SliceHandle } from './runtime-types';