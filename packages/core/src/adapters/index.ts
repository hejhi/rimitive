/**
 * @fileoverview Adapter module exports
 */

export {
  type StoreAdapter,
  type AdapterFactory,
  isStoreAdapter,
  isAdapterFactory,
} from './contract';

export { vanillaAdapter } from './vanilla';