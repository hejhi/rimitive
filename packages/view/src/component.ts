/**
 * Lazy component pattern for @lattice/view
 *
 * Components defined with create() receive the API at instantiation time,
 * eliminating the need to pass API as a parameter through every component.
 */

import { type RefSpec, type Reactive, type ElRefSpecChild } from './types';
import type { ElementProps as ElElementProps } from './el';
import type { AdapterConfig } from './adapter';

/**
 * Signal function with both getter and setter
 */
export type SignalFunction<T> = {
  (): T; // Read operation
  (value: T): void; // Write operation
  peek(): T; // Non-tracking read
};

/**
 * Computed function (read-only)
 */
export type ComputedFunction<T> = {
  (): T; // Read operation
  peek(): T; // Non-tracking read
};

/**
 * Tag factory - returned from el(tag)
 * Callable with children to create RefSpec, or use .props() to add properties
 */
export type TagFactory<
  TConfig extends AdapterConfig,
  Tag extends keyof TConfig['props'] & keyof TConfig['elements'],
> = {
  /**
   * Apply children to create a RefSpec
   */
  (...children: ElRefSpecChild[]): RefSpec<TConfig['elements'][Tag]>;

  /**
   * Add properties to the element, returning a new TagFactory
   */
  props(
    propsOrFn:
      | ElElementProps<TConfig, Tag>
      | ((
          current: ElElementProps<TConfig, Tag>
        ) => ElElementProps<TConfig, Tag>)
  ): TagFactory<TConfig, Tag>;

  /**
   * Add a lifecycle callback, returning a new TagFactory
   */
  ref(
    callback: (element: TConfig['elements'][Tag]) => void | (() => void)
  ): TagFactory<TConfig, Tag>;
};

/**
 * Type for the el method - returns a TagFactory
 * Generic over TConfig to match the renderer configuration
 */
export type ElMethod<TConfig extends AdapterConfig> = {
  // Static element builder - returns TagFactory with .props() method
  <Tag extends string & keyof TConfig['elements']>(
    tag: Tag
  ): TagFactory<TConfig, Tag>;
  // Reactive element builder - tag can be dynamic or null for conditional rendering
  <Tag extends keyof TConfig['elements']>(
    reactive: Reactive<Tag | null>,
    props?: Record<string, unknown>
  ): (...children: ElRefSpecChild[]) => RefSpec<TConfig['baseElement']>;
};
