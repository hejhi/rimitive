/**
 * Core types for @lattice/view
 */

import type { Readable, ScheduledNode } from '@lattice/signals/types';

/**
 * Status bits for node ref type discrimination
 */
export const STATUS_ELEMENT = 1;
export const STATUS_FRAGMENT = 2;

export interface BaseRef<TRef> {
  status: number;
  prev?: TRef;
  next?: TRef;
}

/**
 * Element ref node - wraps created elements for sibling tracking
 */
export interface ElementRef<TElement> extends BaseRef<NodeRef<TElement>> {
  status: typeof STATUS_ELEMENT;
  element: TElement;
}

/**
 * Fragment ref node - wraps fragments (no DOM element)
 * Created by createFragment() - users don't construct this directly
 */
export interface FragmentRef<TElement> extends BaseRef<NodeRef<TElement>> {
  status: typeof STATUS_FRAGMENT;
  element: TElement | null;
  firstChild?: NodeRef<TElement>;
  lastChild?: NodeRef<TElement>;
  dispose?: () => void;
  attach: (
    parent: ElementRef<TElement>,
    nextSibling?: NodeRef<TElement> | null
  ) => FragmentRef<TElement>;
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
 * Resolve the next DOM element from a NodeRef chain.
 * Walks the `next` chain to find the first actual element, skipping empty fragments.
 *
 * @param ref - Starting NodeRef (typically fragment.next)
 * @returns The next DOM element, or null if end of chain
 */
export function resolveNextRef<TElement>(
  ref: NodeRef<TElement> | undefined
): NodeRef<TElement> | null {
  let current = ref;
  while (current) {
    if (current.status === STATUS_ELEMENT) return current;

    // FragmentRef - try to get first child element
    if (current.firstChild) {
      const firstChild = current.firstChild;

      if (isFragmentRef(firstChild) || isElementRef(firstChild)) return firstChild;
    }

    current = current.next; // Empty fragment - skip to next sibling
  }

  return null;
}

/**
 * Ref spec - a specification/blueprint for a ref that can be instantiated multiple times
 */
export interface RefSpec<TElement = ReactiveElement> {
  (lifecycleCallback: LifecycleCallback<TElement>): RefSpec<TElement>; // Register lifecycle callback (chainable)
  // Instantiate blueprint → creates DOM element with optional extensions
  create<TExt = Record<string, unknown>>(extensions?: TExt): NodeRef<TElement> & TExt;
}

/**
 * Check if value is a ref spec
 */
export function isRefSpec<TElement>(value: unknown): value is RefSpec<TElement> {
  return typeof value === 'function' && 'create' in value;
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
 * Lifecycle callback for element connection/disconnection
 */
export type LifecycleCallback<TElement = object> = (element: TElement) => void | (() => void);

/**
 * Base element type for reactive elements
 * This is intentionally minimal - just an object that can be used as WeakMap keys
 * The actual element type is determined by the renderer
 */
export type ReactiveElement = object;

/**
 * Valid child types for an element
 *
 * Note: Bare functions are not supported. For dynamic content, use map() or other
 * reconciliation helpers that provide efficient updates.
 */
export type ElRefSpecChild<TElement = object> =
  | string
  | number
  | boolean
  | null
  | RefSpec<TElement>
  | Reactive<unknown>
  | FragmentRef<TElement>;

export interface RenderScope<TElement = ReactiveElement> extends ScheduledNode {
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

