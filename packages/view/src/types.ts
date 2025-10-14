/**
 * Core types for @lattice/view
 */

import type { Readable } from '@lattice/signals/types';

/**
 * A reactive value that can be read as a signal or computed
 */
export type Reactive<T = any> = Readable<T>;

/**
 * Check if a value is reactive (signal or computed)
 */
export function isReactive(value: any): value is Reactive {
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
  [key: string]: any;
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
  | HTMLElement
  | ElementRef
  | Reactive<string | number>
  | ReactiveList<any>;

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
export function isReactiveList(value: any): value is ReactiveList<any> {
  return value?.__type === 'reactive-list';
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
export function isElementRef(value: any): value is ElementRef {
  return typeof value === 'function' && 'element' in value && value.element instanceof HTMLElement;
}

/**
 * Base element type for reactive elements
 * This is intentionally minimal - just an object that can be used as WeakMap keys
 * The actual element type is determined by the renderer
 */
export type ReactiveElement = object;
