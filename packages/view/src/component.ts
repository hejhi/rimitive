/**
 * Lazy component pattern for @lattice/view
 *
 * Components defined with create() receive the API at instantiation time,
 * eliminating the need to pass API as a parameter through every component.
 */

import { type RefSpec, type SealedSpec, type Reactive, type ElRefSpecChild, type NodeRef, STATUS_SEALED_SPEC } from './types';
import type { ElementProps as ElElementProps } from './el';
import type { RendererConfig } from './renderer';

/**
 * Signal function with both getter and setter
 */
export interface SignalFunction<T> {
  (): T;                    // Read operation
  (value: T): void;         // Write operation
  peek(): T;                // Non-tracking read
}

/**
 * Computed function (read-only)
 */
export interface ComputedFunction<T> {
  (): T;                    // Read operation
  peek(): T;                // Non-tracking read
}

/**
 * Type for the el method with both overloads
 * Generic over TConfig to match the renderer configuration
 */
export interface ElMethod<TConfig extends RendererConfig> {
  // Static element builder
  <Tag extends string & keyof TConfig['elements']>(
    tag: Tag,
    props?: ElElementProps<TConfig, Tag>
  ): (...children: ElRefSpecChild[]) => RefSpec<TConfig['elements'][Tag]>;
  // Reactive element builder - tag can be dynamic or null for conditional rendering
  <Tag extends keyof TConfig['elements']>(
    reactive: Reactive<Tag | null>,
    props?: Record<string, unknown>
  ): (...children: ElRefSpecChild[]) => RefSpec<TConfig['baseElement']>;
}

/**
 * Create a component that receives API at instantiation time
 *
 * Components defined with create() don't need the API passed as a parameter.
 * Instead, they receive it when .create(api) is called, which returns a NodeRef.
 *
 * Generic over the actual API type - no prescriptive interface required.
 *
 * All extensions (el, map, etc.) return RefSpec, which gets automatically instantiated.
 */
export function create<TArgs extends unknown[], TElement, TApi = unknown>(
  factory: (api: TApi) => (...args: TArgs) => RefSpec<TElement>
) {
  return (...args: TArgs): SealedSpec<TElement> => ({
    status: STATUS_SEALED_SPEC,
    create: (api: TApi): NodeRef<TElement> => {
      const componentFactory = factory(api);
      const refSpec = componentFactory(...args);
      return refSpec.create(api) as NodeRef<TElement>;
    }
  });
}
