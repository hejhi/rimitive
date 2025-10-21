/**
 * Core types for @lattice/view
 */

import type { Readable } from '@lattice/signals/types';

/**
 * Status bits for node ref type discrimination
 */
export const STATUS_ELEMENT = 1;
export const STATUS_FRAGMENT = 2;

interface BaseRef<TElement> {
  status: number;
  prev?: NodeRef<TElement>;
  next?: NodeRef<TElement>;
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
  attach: (parent: TElement, nextSibling: TElement | null) => void;
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
