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
 * Instead, they receive it when .create(api) is called, which returns a NodeRef.
 *
 * @param factory - Function that receives API and returns a component function
 * @returns A function that takes component arguments and returns an Instantiatable
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
 * // Compose without API
 * const counterSpec = Counter(10);
 *
 * // Instantiate with API - returns NodeRef directly
 * const nodeRef = counterSpec.create(api);
 * app.appendChild(nodeRef.element);
 * ```
 */
export function create<TArgs extends unknown[], TElement, TRendererElement extends RendererElement = RendererElement>(
  factory: (api: LatticeViewAPI<TRendererElement>) => (...args: TArgs) => RefSpec<TElement>
) {
  return (...args: TArgs): SealedSpec<TElement> => {
    // Use lattice create for API injection
    const baseInstantiatable = baseCreate(factory)(...args);

    // Return a SealedSpec that wraps the RefSpec's create
    return {
      status: STATUS_SEALED_SPEC,
      create(api: LatticeViewAPI<TRendererElement>): NodeRef<TElement> {
        // Step 1: Inject API to get RefSpec
        const refSpec = baseInstantiatable.create(api);

        // Step 2: Call RefSpec's create, passing API for nested components
        return refSpec.create(api);
      }
    };
  };
}

