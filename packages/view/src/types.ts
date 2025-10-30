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
 * Ref spec - a specification/blueprint for a ref that can be instantiated multiple times
 */
export interface RefSpec<TElement> {
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
export type LifecycleCallback<TElement> = (element: TElement) => void | (() => void);

/**
 * Valid child types for an element
 *
 * Note: Bare functions are not supported. For dynamic content, use map() or other
 * reconciliation helpers that provide efficient updates.
 */
export type ElRefSpecChild<TElement> =
  | string
  | number
  | boolean
  | null
  | RefSpec<TElement>
  | Reactive<unknown>
  | FragmentRef<TElement>;

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

