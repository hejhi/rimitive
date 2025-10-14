/**
 * Core types for @lattice/view
 */

import type { Readable } from '@lattice/signals/types';

// PATTERN: Bit flags for ref types (like signals PRODUCER/CONSUMER/SCHEDULED)
// Using bits 0-1 for ref type discrimination
export const ELEMENT_REF = 1 << 0;      // Regular element ref from el()
export const DEFERRED_LIST_REF = 1 << 1; // Deferred list ref from elMap()

export const REF_TYPE_MASK = ELEMENT_REF | DEFERRED_LIST_REF;

/**
 * PATTERN: Internal node representation (like signals ProducerNode/ConsumerNode)
 * ViewNode is the internal object that holds element state and metadata.
 * The public API returns functions that close over these nodes.
 */
export interface ViewNode<TElement = ReactiveElement> {
  refType: number;      // Bit flag for type discrimination
  element: TElement;    // The underlying element
}

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
 * Props for an element - type-safe based on the HTML tag
 */
export type ElementProps<Tag extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap> =
  Partial<HTMLElementTagNameMap[Tag]> & {
    style?: Partial<CSSStyleDeclaration>;
  };

/**
 * Element specification: [tag, ...propsAndChildren]
 */
export type ElementSpec<Tag extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap> = [
  tag: Tag,
  ...content: (ElementProps<Tag> | ElementChild)[]
];

/**
 * Valid child types for an element
 */
export type ElementChild =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReactiveElement
  | ElementRef
  | Reactive<string | number>
  | DeferredListRef;

/**
 * Deferred list ref - a callable that receives parent element
 * Returned by elMap() and called by el() with parent element
 * PATTERN: Like ElementRef, closes over internal node
 */
export interface DeferredListRef<TElement = ReactiveElement> {
  (parent: TElement): void;
  node: ViewNode<TElement | null>; // null element until parent provided
}

/**
 * Check if a value is a deferred list ref
 */
export function isDeferredListRef(value: unknown): value is DeferredListRef {
  return typeof value === 'function' &&
    'node' in value &&
    ((value as { node: ViewNode }).node.refType & DEFERRED_LIST_REF) !== 0;
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
 * Element ref - a callable function that closes over an internal ViewNode
 * PATTERN: Like signals, the function is the public API, node is internal
 */
export interface ElementRef<TElement = ReactiveElement> {
  (lifecycleCallback: LifecycleCallback<TElement>): TElement;
  node: ViewNode<TElement>; // Internal node (exposed for helpers)
}

/**
 * Check if value is an element ref
 */
export function isElementRef(value: unknown): value is ElementRef {
  return typeof value === 'function' &&
    'node' in value &&
    ((value as { node: ViewNode }).node.refType & ELEMENT_REF) !== 0;
}

/**
 * Base element type for reactive elements
 * This is intentionally minimal - just an object that can be used as WeakMap keys
 * The actual element type is determined by the renderer
 */
export type ReactiveElement = object;
