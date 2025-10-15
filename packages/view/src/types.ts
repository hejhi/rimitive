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
 * ViewNode is the base interface for internal objects that hold element state.
 * The public API returns functions that close over these nodes.
 */
export interface ViewNode<TElement = ReactiveElement> {
  refType: number;      // Bit flag for type discrimination
  element: TElement;    // The underlying element
}

/**
 * Element node - created by el()
 * Holds a single element with its associated metadata
 */
export interface ElementNode<TElement = ReactiveElement> extends ViewNode<TElement> {
  refType: typeof ELEMENT_REF; // Always ELEMENT_REF
}

/**
 * List item node - represents an item in a reactive list
 * PATTERN: Like DOM Node - forms intrusive doubly-linked list via sibling pointers
 *
 * DOM parallel:
 * - parentNode ↔ parentList
 * - previousSibling ↔ previousSibling
 * - nextSibling ↔ nextSibling
 */
export interface ListItemNode<T = unknown, TElement = ReactiveElement> extends ViewNode<TElement> {
  key: string;              // Unique key for reconciliation
  itemData: T;              // The actual data
  itemSignal?: ((value: T) => void) & (() => T); // Writable signal for reactivity
  position: number;         // Current position in list (cached for LIS algorithm)

  // DOM-like navigation (intrusive linked list - nodes link directly to each other)
  parentList: DeferredListNode<TElement> | undefined;     // Like DOM parentNode
  previousSibling: ListItemNode<unknown, TElement> | undefined;  // Like DOM previousSibling
  nextSibling: ListItemNode<unknown, TElement> | undefined;      // Like DOM nextSibling
}

/**
 * Deferred list node - created by elMap()
 * PATTERN: Like DOM ParentNode - maintains head/tail of children
 *
 * DOM parallel:
 * - firstChild ↔ firstChild
 * - lastChild ↔ lastChild
 * - childNodes ↔ itemsByKey (Map is for efficient key lookup, DOM uses array)
 */
export interface DeferredListNode<TElement = ReactiveElement> extends ViewNode<TElement | null> {
  refType: typeof DEFERRED_LIST_REF; // Always DEFERRED_LIST_REF
  element: TElement | null; // null until parent provided

  // DOM-like children list (intrusive doubly-linked list)
  firstChild: ListItemNode<unknown, TElement> | undefined;  // Like DOM firstChild
  lastChild: ListItemNode<unknown, TElement> | undefined;   // Like DOM lastChild

  // Key-based lookup for O(1) reconciliation during diffing
  // (DOM uses array-based childNodes, we use Map for key lookup)
  itemsByKey: Map<string, ListItemNode<unknown, TElement>>;
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
 * PATTERN: Like ElementRef, closes over internal DeferredListNode
 */
export interface DeferredListRef<TElement = ReactiveElement> {
  (parent: TElement): void;
  node: DeferredListNode<TElement>; // null element until parent provided
}

/**
 * Check if a value is a deferred list ref
 */
export function isDeferredListRef(value: unknown): value is DeferredListRef {
  return typeof value === 'function' &&
    'node' in value &&
    ((value as { node: DeferredListNode }).node.refType & DEFERRED_LIST_REF) !== 0;
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
 * Element ref - a callable function that closes over an internal ElementNode
 * PATTERN: Like signals, the function is the public API, node is internal
 */
export interface ElementRef<TElement = ReactiveElement> {
  (lifecycleCallback: LifecycleCallback<TElement>): TElement;
  node: ElementNode<TElement>; // Internal node (exposed for helpers)
}

/**
 * Check if value is an element ref
 */
export function isElementRef(value: unknown): value is ElementRef {
  return typeof value === 'function' &&
    'node' in value &&
    ((value as { node: ElementNode }).node.refType & ELEMENT_REF) !== 0;
}

/**
 * Base element type for reactive elements
 * This is intentionally minimal - just an object that can be used as WeakMap keys
 * The actual element type is determined by the renderer
 */
export type ReactiveElement = object;
