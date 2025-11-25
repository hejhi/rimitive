/**
 * Service Module - Browser Version
 *
 * Re-exports browser-safe implementations.
 */

export {
  defineService,
  createBaseService,
  type FullBaseService,
  type BaseService,
} from './define-service.browser';
export type { ServiceDescriptor } from './types';

export { createIsland } from './create-island.browser';
