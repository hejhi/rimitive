/**
 * Lazy component pattern for @lattice/view
 *
 * Components defined with create() receive the API at instantiation time,
 * eliminating the need to pass API as a parameter through every component.
 *
 * @example
 * ```typescript
 * const Counter = create((api) => (initialCount = 0) => {
 *   const { el, signal, on } = api;
 *   const count = signal(initialCount);
 *
 *   return el('div')(
 *     el('button')('+')(on('click', () => count(count() + 1)))()
 *   )();
 * });
 *
 * // Usage - no API needed during composition
 * const counter = Counter(10);
 *
 * // Instantiate with API
 * const api = createLatticeViewAPI();
 * const dom = api.create(counter);
 * ```
 */

import { create as baseCreate } from '@lattice/lattice';
import { type RefSpec, type SealedSpec, type Reactive, type FragmentRef, type ElRefSpecChild, type NodeRef, STATUS_SEALED_SPEC } from './types';
import type { ReactiveElSpec, ElementProps as ElElementProps } from './el';
import type { Element as RendererElement, RendererConfig, Renderer } from './renderer';

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
export interface ElMethod<TConfig extends RendererConfig, TElement extends RendererElement> {
  // Static element builder
  <Tag extends string & keyof TConfig['elements']>(
    tag: Tag,
    props?: ElElementProps<TConfig, Tag>
  ): (...children: ElRefSpecChild[]) => RefSpec<TConfig['elements'][Tag]>;

  // Reactive element builder
  <Tag extends string & keyof TConfig['elements']>(
    reactive: Reactive<ReactiveElSpec<TConfig, Tag>>
  ): FragmentRef<TElement>;
}

/**
 * Minimal API shape needed for lazy components
 *
 * Generic over:
 * - TConfig: The renderer configuration (defines available elements and events)
 * - TElement: Base element type used by the renderer (e.g., HTMLElement for DOM)
 */
export interface LatticeViewAPI<
  TConfig extends RendererConfig = RendererConfig,
  TElement extends RendererElement = RendererElement
> {
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(compute: () => T) => ComputedFunction<T>;
  batch: <T>(fn: () => T) => T;
  effect: (fn: () => void | (() => void)) => () => void;
  el: ElMethod<TConfig, TElement>;
  on: <K extends string & keyof TConfig['events']>(
    event: K,
    handler: (event: TConfig['events'][K]) => void,
    options?: unknown
  ) => <El extends TElement>(element: El) => () => void;
  map: <T>(
    items: () => T[],
    keyFn?: (item: T) => string | number
  ) => (
    render: (
      itemSignal: Reactive<T>
    ) => RefSpec<TElement> | SealedSpec<TElement>
  ) => FragmentRef<TElement>;
}

/**
 * Create a component that receives API at instantiation time
 *
 * Components defined with create() don't need the API passed as a parameter.
 * Instead, they receive it when .create(api) is called, which returns a NodeRef.
 */
export function create<
  TArgs extends unknown[],
  TElement,
  TConfig extends RendererConfig = RendererConfig,
  TRendererElement extends RendererElement = RendererElement
>(
  factory: (api: LatticeViewAPI<TConfig, TRendererElement>) => (...args: TArgs) => RefSpec<TElement>
) {
  return (...args: TArgs): SealedSpec<TElement> => {
    // Use lattice create for API injection
    const baseInstantiatable = baseCreate(factory)(...args);

    // Return a SealedSpec that wraps the RefSpec's create
    return {
      status: STATUS_SEALED_SPEC,
      create(api: LatticeViewAPI<TConfig, TRendererElement>): NodeRef<TElement> {
        // Step 1: Inject API to get RefSpec
        const refSpec = baseInstantiatable.create(api);

        // Step 2: Call RefSpec's create, passing API for nested components
        return refSpec.create(api);
      }
    };
  };
}

/**
 * Create a renderer-specific component factory
 *
 * This helper infers types from your renderer instance, allowing you to write
 * components without manually specifying configuration types.
 */
export function createRenderer<R extends Renderer<any, any, any>>(
  _renderer: R
) {
  type TConfig = R extends Renderer<infer C, any, any> ? C : never;
  type TElement = R extends Renderer<any, infer E, any> ? E : never;

  return function <TArgs extends unknown[], TElementResult>(
    factory: (api: LatticeViewAPI<TConfig, TElement>) => (...args: TArgs) => RefSpec<TElementResult>
  ): (...args: TArgs) => SealedSpec<TElementResult> {
    return create<TArgs, TElementResult, TConfig, TElement>(factory);
  };
}
