// Core exports without testing utilities
export { memoizeParameterizedView, type MemoizeOptions } from './utils/memoize';
export {
  type StoreAdapter,
  type AdapterFactory,
  isStoreAdapter,
  isAdapterFactory,
} from './adapter-contract';
export {
  subscribeToSlices,
  shallowEqual,
  type SubscribableStore,
  type SubscribeOptions,
} from './subscribe';
export { createLatticeStore } from './runtime';
export type { ReactiveSliceFactory, SliceHandle } from './runtime-types';