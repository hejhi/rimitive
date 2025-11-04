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
 * const app = el('div')(
 *   Counter(10),
 *   Counter(20)
 * )();
 *
 * // Provide API at instantiation
 * const api = createLatticeViewAPI();
 * const dom = app.create({ api });
 * ```
 */

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
 */
export interface ElMethod {
  // Static element builder
  <Tag extends keyof HTMLElementTagNameMap>(
    tag: Tag,
    props?: Record<string, unknown>
  ): (...children: ElRefSpecChild<HTMLElementTagNameMap[Tag]>[]) => RefSpec<HTMLElementTagNameMap[Tag]>;

  // Reactive element builder
  <Tag extends keyof HTMLElementTagNameMap>(
    reactive: Reactive<ReactiveElSpec<Tag, RendererElement>>
  ): FragmentRef<RendererElement>;
}

/**
 * Minimal API shape needed for lazy components
 */
export interface LatticeViewAPI {
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(compute: () => T) => ComputedFunction<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  el: ElMethod;
  on: <K extends keyof HTMLElementEventMap>(
    event: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) => (element: HTMLElement) => () => void;
  map: <T>(
    items: () => T[],
    keyFn?: (item: T) => string | number
  ) => (render: (itemSignal: Reactive<T>) => RefSpec<unknown>) => FragmentRef<RendererElement>;
}

/**
 * Symbol to mark lazy component specs
 */
const LAZY_COMPONENT = Symbol('lattice.lazyComponent');

/**
 * A lazy component that will be instantiated when API is provided
 * Implements RefSpec interface so it can be used anywhere RefSpec is expected
 */
export interface LazyComponent<TArgs extends unknown[], TElement> extends RefSpec<TElement> {
  [LAZY_COMPONENT]: true;
  factory: (api: LatticeViewAPI) => (...args: TArgs) => RefSpec<TElement>;
  args: TArgs;
  _callbacks?: Array<(el: TElement) => void | (() => void)>;
}

/**
 * Create a lazy component that receives API at instantiation time
 *
 * Components defined with create() don't need the API passed as a parameter.
 * Instead, they receive it automatically when .create({ api }) is called on
 * the root spec.
 *
 * @param factory - Function that receives API and returns a component function
 * @returns A function that takes component arguments and returns a lazy component
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
 * // Use in composition - no API needed
 * const app = el('div')(
 *   el('h1')('My App')(),
 *   Counter(10)
 * )();
 *
 * // Instantiate with API
 * const api = createLatticeViewAPI();
 * const dom = app.create({ api });
 * ```
 */
export function create<TArgs extends unknown[], TElement>(
  factory: (api: LatticeViewAPI) => (...args: TArgs) => RefSpec<TElement>
) {
  return (...args: TArgs): LazyComponent<TArgs, TElement> => {
    const lazy: LazyComponent<TArgs, TElement> = Object.assign(
      (...callbacks: Array<(el: TElement) => void | (() => void)>) => {
        // Forward lifecycle callbacks
        lazy._callbacks = lazy._callbacks || [];
        lazy._callbacks.push(...callbacks);
        return lazy;
      },
      {
        [LAZY_COMPONENT]: true as const,
        factory,
        args,
        status: STATUS_REF_SPEC,
        _callbacks: [] as Array<(el: TElement) => void | (() => void)>,
        create: <TExt>(optionsOrExtensions?: unknown): NodeRef<TElement> & TExt => {
          const options = optionsOrExtensions as { api?: LatticeViewAPI; extensions?: TExt };
          const api = options?.api;
          if (!api) {
            throw new Error(
              'Lazy component used but no API provided. ' +
              'Call .create({ api }) at the root to provide API to lazy components.'
            );
          }

          // Instantiate the component with the API
          const component = lazy.factory(api);
          const spec = component(...lazy.args);

          // Apply stored lifecycle callbacks
          if (lazy._callbacks) {
            for (const cb of lazy._callbacks) {
              spec(cb as never);
            }
          }

          // Create and return the actual element
          return spec.create(optionsOrExtensions) as unknown as NodeRef<TElement> & TExt;
        },
      }
    );

    return lazy;
  };
}

/**
 * Type guard to check if value is a lazy component
 *
 * @param value - Value to check
 * @returns True if value is a lazy component
 */
export function isLazyComponent(value: unknown): value is LazyComponent<unknown[], unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    LAZY_COMPONENT in value
  );
}

/**
 * Instantiate a lazy component with the provided API
 *
 * This is called internally by processChildren when it encounters a lazy component.
 *
 * @param lazy - The lazy component to instantiate
 * @param api - The API to provide to the component
 * @returns A RefSpec that can be instantiated normally
 */
export function instantiateLazyComponent<TElement extends RendererElement>(
  lazy: LazyComponent<unknown[], TElement>,
  api: LatticeViewAPI
): RefSpec<TElement> {
  const component = lazy.factory(api);
  return component(...lazy.args);
}
