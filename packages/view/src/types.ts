/**
 * Core types for @lattice/view
 */

// Re-export renderer types so they're available from @lattice/view/types
export type { Renderer, RendererConfig } from './renderer';
export type { ReactiveAdapter } from './reactive-adapter';

import type { Instantiatable } from '@lattice/lattice';

/**
 * Status bits for node ref type discrimination
 * Using powers of 2 for bitwise operations
 */
export const STATUS_ELEMENT = 1; // 0001
export const STATUS_FRAGMENT = 2; // 0010
export const STATUS_REF_SPEC = 4; // 0100
export const STATUS_COMMENT = 16; // 10000

/**
 * Composite bit masks for checking types
 */
export const STATUS_NODE_MASK = STATUS_ELEMENT | STATUS_FRAGMENT; // 0011 (3)
export const STATUS_SPEC_MASK = STATUS_REF_SPEC; // 0100 (4)

export interface BaseRef {
  status: number;
}

/**
 * Linked nodes - nodes that form doubly-linked lists
 * Elements are actual DOM nodes in the list
 * Fragments are logical nodes that own their own child lists
 */
export type LinkedNode<TElement> = ElementRef<TElement> | FragmentRef<TElement>;

/**
 * Element ref node - wraps created elements for tree structure
 * Forms doubly-linked list with prev/next pointers for efficient sibling traversal
 * Links to parent for tree traversal
 * Tracks child NodeRefs for tree walking (needed for SSR fragment detection)
 */
export interface ElementRef<TElement> extends BaseRef {
  status: typeof STATUS_ELEMENT;
  element: TElement;
  parent: ElementRef<unknown> | null; // Parent element in tree
  prev: LinkedNode<unknown> | null; // Previous sibling in doubly-linked list
  next: LinkedNode<unknown> | null; // Next sibling in doubly-linked list

  // Child list (nodes within this element) - using LinkedNode for fragments
  firstChild: LinkedNode<unknown> | null;
  lastChild: LinkedNode<unknown> | null;
}

/**
 * Fragment ref node - logical container in the tree (no DOM element)
 * Fragments participate in parent's doubly-linked list and own their own child list
 */
export interface FragmentRef<TElement> extends BaseRef {
  status: typeof STATUS_FRAGMENT;
  element: null;

  // Position in parent's doubly-linked list
  // Uses 'unknown' for variance - allows FragmentRef<T> to be assignable to FragmentRef<unknown>
  parent: ElementRef<unknown> | null;
  prev: NodeRef<unknown> | null;
  next: NodeRef<unknown> | null;

  // Own child list (nodes within this fragment)
  firstChild: LinkedNode<TElement> | null;
  lastChild: LinkedNode<TElement> | null;

  // Attach method - called when fragment is attached to the tree
  // Method syntax (not property) is bivariant, allowing proper typing while maintaining variance
  attach(
    parent: ElementRef<TElement>,
    nextSibling: NodeRef<TElement> | null,
    api?: unknown
  ): void | (() => void);
}

/**
 * Ref node - union of element/fragment tracking nodes
 */
export type NodeRef<TElement> = ElementRef<TElement> | FragmentRef<TElement>;

/**
 * Ref spec - a specification/blueprint for a ref that can be instantiated multiple times
 * Extends Instantiatable to provide uniform context injection pattern
 */
export interface RefSpec<TElement>
  extends Instantiatable<NodeRef<TElement>, unknown> {
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
export type LifecycleCallback<TElement> = (
  element: TElement
) => void | (() => void);

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
