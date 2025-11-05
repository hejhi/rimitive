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
import type { RefSpec, Reactive, FragmentRef, ElRefSpecChild, NodeRef } from './types';
import { STATUS_REF_SPEC } from './types';
import type { ReactiveElSpec } from './el';
import type { Element as RendererElement } from './renderer';

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
 * Generic over TElement to match the element type used by the renderer
 */
export interface ElMethod<TElement extends RendererElement> {
  // Static element builder
  <Tag extends keyof HTMLElementTagNameMap>(
    tag: Tag,
    props?: Record<string, unknown>
  ): (...children: ElRefSpecChild[]) => RefSpec<HTMLElementTagNameMap[Tag]>;

  // Reactive element builder
  <Tag extends keyof HTMLElementTagNameMap>(
    reactive: Reactive<ReactiveElSpec<Tag>>
  ): FragmentRef<TElement>;
}

/**
 * Minimal API shape needed for lazy components
 * Generic over TElement to match the element type used by the renderer (e.g., HTMLElement for DOM)
 */
export interface LatticeViewAPI<TElement extends RendererElement = RendererElement> {
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(compute: () => T) => ComputedFunction<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  el: ElMethod<TElement>;
  on: <K extends keyof HTMLElementEventMap>(
    event: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) => (element: HTMLElement) => () => void;
  map: <T>(
    items: () => T[],
    keyFn?: (item: T) => string | number
  ) => (render: (itemSignal: Reactive<T>) => RefSpec<TElement>) => FragmentRef<TElement>;
}

/**
 * Create a component that receives API at instantiation time
 *
 * Components defined with create() don't need the API passed as a parameter.
 * Instead, they receive it automatically when api.create() is called.
 *
 * @param factory - Function that receives API and returns a component function
 * @returns A function that takes component arguments and returns a RefSpec
 *
 * @example
 * ```typescript
 * // Define component
 * const Counter = create((api) => (initialCount = 0) => {
 *   const { el, signal, on } = api;
 *   const count = signal(initialCount);
 *
 *   return el('div')(
 *     el('p')(`Count: ${count()}`)(),
 *     el('button')('+')(on('click', () => count(count() + 1)))()
 *   )();
 * });
 *
 * // Use component - no API needed during composition
 * const counter = Counter(10);
 *
 * // Instantiate with API
 * const api = createLatticeViewAPI();
 * const dom = api.create(counter);
 * ```
 */
export function create<TArgs extends unknown[], TElement, TRendererElement extends RendererElement = RendererElement>(
  factory: (api: LatticeViewAPI<TRendererElement>) => (...args: TArgs) => RefSpec<TElement>
) {
  return (...args: TArgs): RefSpec<TElement> => {
    const lifecycleCallbacks: Array<(el: TElement) => void | (() => void)> = [];

    // Create the base instantiatable using the generic pattern
    const baseInstantiatable = baseCreate(factory)(...args);

    // Wrap it with RefSpec interface (lifecycle callbacks + status)
    const refSpec: RefSpec<TElement> = (...callbacks) => {
      lifecycleCallbacks.push(...callbacks);
      return refSpec;
    };

    refSpec.status = STATUS_REF_SPEC;

    refSpec.create = <TExt>(api?: unknown, extensions?: TExt): NodeRef<TElement> & TExt => {
      if (!api) {
        throw new Error('create() requires api parameter for components');
      }

      // Use the base instantiatable's create to get the spec
      const spec = baseInstantiatable.create(api as LatticeViewAPI<TRendererElement>);

      // Apply stored lifecycle callbacks
      for (const cb of lifecycleCallbacks) {
        spec(cb);
      }

      // Create with the api
      return spec.create(api, extensions);
    };

    return refSpec;
  };
}

