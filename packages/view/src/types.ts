/**
 * Core types for @lattice/view
 */

import type { Readable } from '@lattice/signals/types';
import type { Scope } from './helpers/scope';

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
 * Extended element type with scope tracking
 */
export interface ReactiveElement extends HTMLElement {
  __scope?: Scope;
  __disposeCallback?: () => void;
}
