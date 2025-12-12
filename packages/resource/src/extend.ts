/**
 * Module exports for custom composition
 *
 * Use these when building custom module configurations:
 * ```typescript
 * import { ResourceModule } from '@rimitive/resource/extend';
 * import { compose, instantiate } from '@rimitive/core';
 *
 * const modules = compose(ResourceModule);
 * const { resource } = instantiate(modules);
 * ```
 */

export {
  ResourceModule,
  createResourceFactory,
  type ResourceDeps,
} from './resource';
export type {
  Resource,
  ResourceState,
  Fetcher,
  ResourceFactory,
} from './types';
