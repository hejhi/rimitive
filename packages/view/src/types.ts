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
 * Element specification: [tag, ...propsAndChildren]
 */
export type ElementSpec = [
  tag: string,
  ...content: (ElementProps | ElementChild)[]
];

/**
 * Props for an element (attributes, event handlers)
 */
export type ElementProps = {
  [key: string]: unknown;
};

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
  | ReactiveList<unknown>;

/**
 * A reactive list returned by elMap()
 */
export interface ReactiveList<T> {
  __type: 'reactive-list';
  signal: Reactive<T[]>;
  render: (itemSignal: Reactive<T>) => HTMLElement;
  keyFn?: (item: T) => unknown;
  __container?: ReactiveElement;
}

/**
 * Check if a value is a reactive list
 */
export function isReactiveList(value: unknown): value is ReactiveList<unknown> {
  return typeof value === 'object' && value !== null && '__type' in value && (value as { __type: string }).__type === 'reactive-list';
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
