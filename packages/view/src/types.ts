/**
 * Core types for @lattice/view
 */

import type { Instantiatable } from '@lattice/lattice';

/**
 * Status bits for node ref type discrimination
 * Using powers of 2 for bitwise operations
 */
export const STATUS_ELEMENT = 1;      // 0001
export const STATUS_FRAGMENT = 2;     // 0010
export const STATUS_REF_SPEC = 4;     // 0100
export const STATUS_SEALED_SPEC = 8;  // 1000
export const STATUS_COMMENT = 16;     // 10000

/**
 * Composite bit masks for checking types
 */
export const STATUS_NODE_MASK = STATUS_ELEMENT | STATUS_FRAGMENT | STATUS_COMMENT;     // 10011 (19)
export const STATUS_SPEC_MASK = STATUS_REF_SPEC | STATUS_SEALED_SPEC; // 1100 (12)

export interface BaseRef {
  status: number;
}

/**
 * Linked nodes - actual DOM nodes that form doubly-linked list
 * Elements and Comments are in the list; Fragments are range markers
 */
export type LinkedNode<TElement> = ElementRef<TElement> | CommentRef;

/**
 * Element ref node - wraps created elements for sibling tracking
 * Forms doubly-linked list with prev/next pointers for efficient traversal
 */
export interface ElementRef<TElement> extends BaseRef {
  status: typeof STATUS_ELEMENT;
  element: TElement;
  prev: LinkedNode<TElement> | null;  // Previous DOM node in doubly-linked list
  next: LinkedNode<TElement> | null;  // Next DOM node in doubly-linked list
}

/**
 * Fragment ref node - wraps fragments (no DOM element)
 * Created by createFragment() - users don't construct this directly
 * Fragments are range markers that track firstChild/lastChild in the doubly-linked element list
 */
export interface FragmentRef<TElement> extends BaseRef {
  status: typeof STATUS_FRAGMENT;
  element: TElement | null;
  firstChild: LinkedNode<TElement> | undefined;  // First node in fragment's range
  lastChild: LinkedNode<TElement> | undefined;   // Last node in fragment's range
  // Bivariant function property with widened parameters for variance
  // Parameters use 'unknown' to allow FragmentRef<T> to be assignable to FragmentRef<unknown>
  // This is safe because at runtime all element types are compatible
  attach: {
    (parent: ElementRef<unknown>, nextSibling?: NodeRef<unknown> | null, api?: unknown): FragmentRef<TElement>;
  };
}

/**
 * Comment ref node - wraps comment nodes for markers
 * Part of doubly-linked list with prev/next pointers
 */
export interface CommentRef extends BaseRef {
  status: typeof STATUS_COMMENT;
  data: string;
  element: unknown;  // The actual DOM comment node (renderer-specific type)
  prev: LinkedNode<unknown> | null;  // Previous DOM node in doubly-linked list
  next: LinkedNode<unknown> | null;  // Next DOM node in doubly-linked list
}

/**
 * Ref node - union of element/fragment/comment tracking nodes
 */
export type NodeRef<TElement> = ElementRef<TElement> | FragmentRef<TElement> | CommentRef;

/**
 * Ref spec - a specification/blueprint for a ref that can be instantiated multiple times
 * Extends Instantiatable to provide uniform context injection pattern
 */
export interface RefSpec<TElement> extends Instantiatable<NodeRef<TElement>, unknown> {
  status: typeof STATUS_REF_SPEC;
  (...lifecycleCallbacks: LifecycleCallback<TElement>[]): RefSpec<TElement>; // Register lifecycle callback(s) (chainable)
  // Instantiate blueprint → creates DOM element with optional extensions
  // api parameter is optional - only needed for components created with create()
  create<TExt = Record<string, unknown>>(
    api?: unknown,
    extensions?: TExt
  ): NodeRef<TElement> & TExt;
}

/**
 * Sealed spec - a specification created with create() that doesn't support lifecycle callbacks
 * Simpler than RefSpec - just has status and create, no callable signature
 */
export interface SealedSpec<TElement> extends Instantiatable<NodeRef<TElement>, unknown> {
  status: typeof STATUS_SEALED_SPEC;
  create(api?: unknown): NodeRef<TElement>;
}

/**
 * A reactive value that can be read as a signal or computed
 */
export interface Readable<T> {
  (): T;
}

export interface Writable<T> extends Readable<T> {
  (value: T): void; // Function call with argument for write
}

export type Reactive<T> = Readable<T> | Writable<T>;

/**
 * Lifecycle callback for element connection/disconnection
 */
export type LifecycleCallback<TElement> = (element: TElement) => void | (() => void);

/**
 * Valid child types for an element
 *
 * Note: Bare functions are not supported. For dynamic content, use map() or other
 * reconciliation helpers that provide efficient updates.
 *
 * The TElement parameter is kept for API consistency, but child RefSpecs/FragmentRefs
 * use `unknown` since any element can be a child of any other element at runtime. Using `unknown`
 * (the top type) allows proper variance - any RefSpec<T> is assignable to RefSpec<unknown>.
 */
export type ElRefSpecChild =
  | string
  | number
  | boolean
  | null
  | RefSpec<unknown>
  | SealedSpec<unknown>
  | Reactive<unknown>
  | FragmentRef<unknown>;

export interface RenderScope<TElement> {
  // Type marker
  __type: string;

  // Status for tracking disposal state
  status: number;

  // Tree structure (from Scope) - intrusive singly-linked tree
  firstChild: RenderScope<TElement> | undefined;
  nextSibling: RenderScope<TElement> | undefined;

  // Lifecycle & cleanup (from Scope)
  firstDisposable: DisposableNode | undefined;

  // Element binding (view-specific)
  element: TElement;
}

/**
 * Linked list node for tracking dispose functions
 * Used by RenderScope to track cleanup functions
 */
export interface DisposableNode {
  dispose: () => void;
  next: DisposableNode | undefined;
}

