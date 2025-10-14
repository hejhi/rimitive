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
 * PATTERN: Like ProducerNode/ConsumerNode in signals - participates in graph
 */
export interface ListItemNode<T = unknown, TElement = ReactiveElement> extends ViewNode<TElement> {
  key: string;              // Unique key for reconciliation
  itemData: T;              // The actual data
  itemSignal?: ((value: T) => void) & (() => T); // Writable signal for reactivity

  // Edge to parent list (like consumer.dependencies in signals)
  parentEdge: ListItemEdge<T, TElement> | undefined;
}

/**
 * List item edge - connects list container to item
 * PATTERN: Like Dependency in signals - exists in TWO doubly-linked lists simultaneously:
 * 1. Parent's children list (sibling navigation: prevSibling/nextSibling)
 * 2. Item's parent edge (hierarchy navigation: parent/item)
 *
 * This dual-list structure enables:
 * - O(1) sibling traversal (like iterating producer's subscribers)
 * - O(1) parent/child navigation (like accessing dependency's producer/consumer)
 * - Efficient insertion/removal from both lists
 */
export interface ListItemEdge<T = unknown, TElement = ReactiveElement> {
  parent: DeferredListNode<TElement>;  // The parent list container
  item: ListItemNode<T, TElement>;     // The child item node

  // Sibling list navigation (parent's children)
  // PATTERN: Like Dependency's prevConsumer/nextConsumer
  prevSibling: ListItemEdge<T, TElement> | undefined;
  nextSibling: ListItemEdge<T, TElement> | undefined;
}

/**
 * Deferred list node - created by elMap()
 * PATTERN: Like ProducerNode, maintains head/tail of children list
 */
export interface DeferredListNode<TElement = ReactiveElement> extends ViewNode<TElement | null> {
  refType: typeof DEFERRED_LIST_REF; // Always DEFERRED_LIST_REF
  element: TElement | null; // null until parent provided

  // Intrusive doubly-linked list of children (like producer.subscribers)
  firstChild: ListItemEdge<unknown, TElement> | undefined;  // Head of children list
  lastChild: ListItemEdge<unknown, TElement> | undefined;   // Tail for O(1) append

  // Key-based lookup for O(1) reconciliation (signals doesn't need this because
  // it uses identity-based lookup via trackDependency walking the list)
  itemsByKey: Map<string, ListItemNode<unknown, TElement>>;

  // Track previous items for reconciliation
  previousItems: unknown[];
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
