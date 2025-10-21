/**
 * Core types for @lattice/view
 */

import type { Readable } from '@lattice/signals/types';

/**
 * Status bits for node ref type discrimination
 */
export const STATUS_ELEMENT = 1;
export const STATUS_FRAGMENT = 2;

export interface BaseRef<TElement> {
  status: number;
  prev?: BaseRef<TElement>;
  next?: BaseRef<TElement>;
}

/**
 * Element ref node - wraps created elements for sibling tracking
 */
export interface ElementRef<TElement> extends BaseRef<TElement> {
  status: typeof STATUS_ELEMENT;
  element: TElement;
}

/**
 * Fragment ref node - wraps fragments for deferred attachment
 */
export interface FragmentRef<TElement> extends BaseRef<TElement> {
  status: typeof STATUS_FRAGMENT;
  attach: (parent: TElement, nextSibling?: TElement | null) => void;
  // Fragment children - specific fragments override with concrete types
  // MapState: ListItemNode (extends BaseRef), MatchState: NodeRef<TElement> (extends BaseRef)
  firstChild?: BaseRef<TElement>;
  lastChild?: BaseRef<TElement>;
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
export function resolveNextElement<TElement>(ref: NodeRef<TElement> | undefined): TElement | null {
  let current = ref;
  while (current) {
    // ElementRef - return element directly
    if (current.status === STATUS_ELEMENT) {
      return current.element;
    }

    // FragmentRef - try to get first child element
    if (current.firstChild) {
      const firstChild = current.firstChild;

      // Check if firstChild is a ListItemNode (MapState case) - has .ref property
      if ('ref' in firstChild && 'key' in firstChild) {
        // ListItemNode from MapState - has .ref as NodeRef
        const nodeRef = (firstChild as any).ref as NodeRef<TElement>;
        if (nodeRef.status === STATUS_ELEMENT) {
          return nodeRef.element;
        }
      } else {
        // NodeRef (MatchState case) - could be ElementRef or FragmentRef
        const nodeRef = firstChild as NodeRef<TElement>;
        if (nodeRef.status === STATUS_ELEMENT) {
          return nodeRef.element;
        }
      }
    }

    // Empty fragment - skip to next sibling
    current = current.next as NodeRef<TElement> | undefined;
  }
  return null; // End of chain
}

/**
 * Ref spec - a specification/blueprint for a ref that can be instantiated multiple times
 */
export interface RefSpec<TElement = ReactiveElement> {
  (lifecycleCallback: LifecycleCallback<TElement>): RefSpec<TElement>; // Register lifecycle callback (chainable)
  create(): NodeRef<TElement>; // Instantiate blueprint → creates DOM element
}

/**
 * Check if value is a ref spec
 */
export function isRefSpec<TElement>(value: unknown): value is RefSpec<TElement> {
  return typeof value === 'function' && 'create' in value;
}

/**
 * FragmentSpec - manages DOM relationships without a container element
 * Callable function that attaches to parent
 */
export interface FragmentSpec<TElement = ReactiveElement> {
  (parent: TElement, nextSibling?: TElement | null): void;
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
