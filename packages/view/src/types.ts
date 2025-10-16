/**
 * Core types for @lattice/view
 */

import type { Readable } from '@lattice/signals/types';

// Bit flags for ref types (like signals PRODUCER/CONSUMER/SCHEDULED)
// Nodes create actual DOM elements, Fragments manage relationships/containers
export const ELEMENT_REF = 1 << 0;  // Nodes: create elements (el)
export const FRAGMENT = 1 << 1;     // Fragments: manage relationships (map, match, custom)

export const REF_TYPE_MASK = ELEMENT_REF | FRAGMENT;

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
 * Element node - created by el()
 * Holds a single element with its associated metadata
 */
export interface ElementNode<TElement = ReactiveElement> extends ViewNode<TElement> {
  refType: typeof ELEMENT_REF; // Always ELEMENT_REF
}

/**
 * List item node - represents an item in a reactive list
 * Like DOM Node - forms intrusive doubly-linked list via sibling pointers
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
  status: number;           // Status bits for reconciliation (VISITED, etc.)

  // DOM-like navigation (intrusive linked list - nodes link directly to each other)
  parentList: MapFragmentState<TElement> | undefined;     // Like DOM parentNode
  previousSibling: ListItemNode<unknown, TElement> | undefined;  // Like DOM previousSibling
  nextSibling: ListItemNode<unknown, TElement> | undefined;      // Like DOM nextSibling
}

/**
 * Map fragment state - created by map()
 * Fragment that manages parent→children list relationship
 *
 * Maintains head/tail of children like DOM ParentNode:
 * - firstChild ↔ firstChild
 * - lastChild ↔ lastChild
 * - childNodes ↔ itemsByKey (Map is for efficient key lookup, DOM uses array)
 */
export interface MapFragmentState<TElement = ReactiveElement> extends ViewNode<TElement | null> {
  refType: typeof FRAGMENT;
  element: TElement | null; // Parent element (null until fragment attached)

  // DOM-like children list (intrusive doubly-linked list)
  firstChild: ListItemNode<unknown, TElement> | undefined;  // Like DOM firstChild
  lastChild: ListItemNode<unknown, TElement> | undefined;   // Like DOM lastChild

  // Key-based lookup for O(1) reconciliation during diffing
  // (DOM uses array-based childNodes, we use Map for key lookup)
  itemsByKey: Map<string, ListItemNode<unknown, TElement>>;
}

/**
 * Match fragment state - created by match()
 * Fragment that manages parent→conditional child relationship
 *
 * Tracks territory in parent via currentChild and nextSibling:
 * - When visible: currentChild points to rendered element
 * - When hidden: currentChild is null, but nextSibling marks position
 * - Insert before nextSibling to maintain stable position
 */
export interface MatchFragmentState<TElement = ReactiveElement> extends ViewNode<TElement | null> {
  refType: typeof FRAGMENT;
  element: TElement | null; // Parent element (null until fragment attached)
  currentChild: TElement | null; // Currently rendered child element (null when hidden)
  nextSibling: TElement | null; // DOM element after our territory (for stable insertion, null = append at end)
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
 * Map fragment - a callable that receives parent element
 * Returned by map() and called by el() with parent element
 * Fragment that manages parent→children list relationship
 */
export interface MapFragment<TElement = ReactiveElement> {
  (parent: TElement): void;
  refType: typeof FRAGMENT;
}

/**
 * Match fragment - a callable that receives parent element
 * Returned by match() and called by el() with parent element
 * Fragment that manages parent→conditional child relationship
 */
export interface MatchFragment<TElement = ReactiveElement> {
  (parent: TElement): void;
  refType: typeof FRAGMENT;
}

/**
 * Fragment - union of all fragment types (map, match, custom)
 */
export type Fragment<TElement = ReactiveElement> = MapFragment<TElement> | MatchFragment<TElement>;

/**
 * Check if a value is a fragment
 */
export function isFragment(value: unknown): value is Fragment {
  return typeof value === 'function' &&
    'refType' in value &&
    ((value as { refType: number }).refType & FRAGMENT) !== 0;
}

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
  | Fragment;

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
 * Element ref - a blueprint that can be instantiated multiple times
 * PATTERN: Like signals, the function is the public API, blueprint is internal
 */
export interface ElementRef<TElement = ReactiveElement> {
  (lifecycleCallback: LifecycleCallback<TElement>): ElementRef<TElement>; // Register lifecycle callback (chainable)
  create(): TElement; // Instantiate blueprint → creates new DOM element instance
}

/**
 * Check if value is an element ref
 */
export function isElementRef(value: unknown): value is ElementRef {
  return typeof value === 'function' &&
    'create' in value &&
    typeof (value as { create: unknown }).create === 'function';
}

/**
 * Base element type for reactive elements
 * This is intentionally minimal - just an object that can be used as WeakMap keys
 * The actual element type is determined by the renderer
 */
export type ReactiveElement = object;
