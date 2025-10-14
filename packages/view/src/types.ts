/**
 * Core types for @lattice/view
 */

import type { Readable } from '@lattice/signals/types';

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
 */
export interface DeferredListRef<TElement = ReactiveElement> {
  (parent: TElement): void;
  __type: 'deferred-list';
}

/**
 * Check if a value is a deferred list ref
 */
export function isDeferredListRef(value: unknown): value is DeferredListRef {
  return typeof value === 'function' && '__type' in value && (value as { __type: string }).__type === 'deferred-list';
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
 * Element ref - a callable function that holds the element
 */
export interface ElementRef<TElement = ReactiveElement> {
  (lifecycleCallback: LifecycleCallback<TElement>): TElement;
  element: TElement;
}

/**
 * Check if value is an element ref
 */
export function isElementRef(value: unknown): value is ElementRef {
  return typeof value === 'function' && 'element' in value;
}

/**
 * Base element type for reactive elements
 * This is intentionally minimal - just an object that can be used as WeakMap keys
 * The actual element type is determined by the renderer
 */
export type ReactiveElement = object;
