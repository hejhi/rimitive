/**
 * Core types for @lattice/view
 */

import type { Readable, ScheduledNode } from '@lattice/signals/types';
import type { Instantiatable } from '@lattice/lattice';

/**
 * Status bits for node ref type discrimination
 */
export const STATUS_ELEMENT = 1;
export const STATUS_FRAGMENT = 2;
export const STATUS_REF_SPEC = 3;

export interface BaseRef {
  status: number;
  next?: BaseRef;
}

/**
 * Element ref node - wraps created elements for sibling tracking
 */
export interface ElementRef<TElement> extends BaseRef {
  status: typeof STATUS_ELEMENT;
  element: TElement;
}

/**
 * Fragment ref node - wraps fragments (no DOM element)
 * Created by createFragment() - users don't construct this directly
 */
export interface FragmentRef<TElement> extends BaseRef {
  status: typeof STATUS_FRAGMENT;
  element: TElement | null;
  firstChild?: BaseRef;
  dispose?: () => void;
  // Bivariant function property with widened parameters for variance
  // Parameters use 'unknown' to allow FragmentRef<T> to be assignable to FragmentRef<unknown>
  // This is safe because at runtime all element types are compatible
  attach: {
    (parent: ElementRef<unknown>, nextSibling?: NodeRef<unknown> | null): FragmentRef<TElement>;
  };
}

/**
 * Ref node - union of element/fragment tracking nodes
 */
export type NodeRef<TElement> = ElementRef<TElement> | FragmentRef<TElement>;

/**
 * Type guard - check if NodeRef is an ElementRef
 */
export function isElementRef<TElement>(nodeRef: NodeRef<TElement>): nodeRef is ElementRef<TElement> {
  return nodeRef.status === STATUS_ELEMENT;
}

/**
 * Type guard - check if NodeRef is a FragmentRef
 */
export function isFragmentRef<TElement>(nodeRef: NodeRef<TElement>): nodeRef is FragmentRef<TElement> {
  return nodeRef.status === STATUS_FRAGMENT;
}

/**
 * Ref spec - a specification/blueprint for a ref that can be instantiated multiple times
 * Extends Instantiatable to provide uniform context injection pattern
 */
export interface RefSpec<TElement> extends Instantiatable<NodeRef<TElement>, unknown> {
  status: number;
  (...lifecycleCallbacks: LifecycleCallback<TElement>[]): RefSpec<TElement>; // Register lifecycle callback(s) (chainable)
  // Instantiate blueprint → creates DOM element with optional extensions
  // api parameter is optional - only needed for components created with create()
  create<TExt = Record<string, unknown>>(api?: unknown, extensions?: TExt): NodeRef<TElement> & TExt;
}

/**
 * A reactive value that can be read as a signal or computed
 */
export type Reactive<T = unknown> = Readable<T>;

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
  | Reactive<unknown>
  | FragmentRef<unknown>;

export interface RenderScope<TElement> extends ScheduledNode {
  // Tree structure (from Scope) - intrusive singly-linked tree
  firstChild: RenderScope<TElement> | undefined;
  nextSibling: RenderScope<TElement> | undefined;

  // Lifecycle & cleanup (from Scope)
  firstDisposable: DisposableNode | undefined;

  // Element binding (view-specific)
  element: TElement;
  cleanup?: () => void;

  // Reactive rendering (for effect-based scopes)
  renderFn?: () => void | (() => void);
}

/**
 * Linked list node for tracking dispose functions
 * Used by RenderScope to track cleanup functions
 */
export interface DisposableNode {
  dispose: () => void;
  next: DisposableNode | undefined;
}

