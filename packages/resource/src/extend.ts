/**
 * Module exports for custom composition
 *
 * Use these when building custom module configurations:
 * ```typescript
 * import { ResourceModule } from '@lattice/resource/extend';
 * import { compose, instantiate } from '@lattice/lattice';
 *
 * const modules = compose(ResourceModule);
 * const { resource } = instantiate(modules);
 * ```
 */

export { ResourceModule, createResourceFactory, type ResourceDeps } from './resource';
export type { Resource, ResourceState, Fetcher, ResourceFactory } from './types';
