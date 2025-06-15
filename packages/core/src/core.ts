// Core exports without testing utilities
export { compose } from './compose';
export { resolve } from './resolve';
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
export { createStore, type StoreTools, type StoreSliceFactory } from './store';