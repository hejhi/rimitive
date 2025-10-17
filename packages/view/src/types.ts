/**
 * Core types for @lattice/view
 */

import type { Readable } from '@lattice/signals/types';

// Bit flags for ref types (like signals PRODUCER/CONSUMER/SCHEDULED)
// Nodes create actual DOM elements, Fragments manage relationships/containers
export const FRAGMENT = 1 << 1;     // Fragments: manage relationships (map, match, custom)

/**
 * Internal node representation (like signals ProducerNode/ConsumerNode)
 * ViewNode is the base interface for internal objects that hold element state.
 * The public API returns functions that close over these nodes.
 */
export interface ViewNode<TElement = ReactiveElement> {
  refType: number;      // Bit flag for type discrimination
  element: TElement;    // The underlying element
}

/**
 * Ref spec - a specification/blueprint for a ref that can be instantiated multiple times
 */
export interface RefSpec<TElement = ReactiveElement> {
  (lifecycleCallback: LifecycleCallback<TElement>): RefSpec<TElement>; // Register lifecycle callback (chainable)
  create(): TElement; // Instantiate blueprint → creates DOM element
}

/**
 * Check if value is a ref spec
 */
export function isRefSpec<TElement>(value: unknown): value is RefSpec<TElement> {
  return typeof value === 'function' && 'create' in value;
}

/**
 * Fragment - ref with no container and one or more children
 */
export type Fragment<TElement = ReactiveElement> = {
  (parent: TElement, nextSibling?: TElement | null): void;
  refType: typeof FRAGMENT;
};

/**
 * A reactive value that can be read as a signal or computed
 */
export type Reactive<T = unknown> = Readable<T>;

/**
 * Check if a value is reactive (signal or computed)
 */
export function isReactive(value: unknown): value is Reactive {
  return typeof value === 'function' &&
    ('peek' in value || '__type' in value);
}

/**
 * Check if a value is a fragment
 */
export function isFragmentSpec(value: unknown): value is Fragment {
  return (
    typeof value === 'function' &&
    'refType' in value &&
    ((value as { refType: number }).refType & FRAGMENT) !== 0
  );
}

/**
 * Something that can be disposed
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Lifecycle callback for element connection/disconnection
 */
export type LifecycleCallback<TElement = object> = (element: TElement) => void | (() => void);

/**
 * Base element type for reactive elements
 * This is intentionally minimal - just an object that can be used as WeakMap keys
 * The actual element type is determined by the renderer
 */
export type ReactiveElement = object;
