/**
 * Lazy component pattern for @lattice/view
 *
 * Components defined with create() receive the API at instantiation time,
 * eliminating the need to pass API as a parameter through every component.
 */

import { type RefSpec, type Reactive, type ElRefSpecChild } from './types';
import type { ElementProps as ElElementProps } from './el';
import type { RendererConfig } from './renderer';

/**
 * Signal function with both getter and setter
 */
export interface SignalFunction<T> {
  (): T; // Read operation
  (value: T): void; // Write operation
  peek(): T; // Non-tracking read
}

/**
 * Computed function (read-only)
 */
export interface ComputedFunction<T> {
  (): T; // Read operation
  peek(): T; // Non-tracking read
}

/**
 * Type for the el method with both overloads
 * Generic over TConfig to match the renderer configuration
 */
export interface ElMethod<TConfig extends RendererConfig> {
  // Static element builder
  <Tag extends string & keyof TConfig['elements']>(
    tag: Tag,
    props?: ElElementProps<TConfig, Tag>
  ): (...children: ElRefSpecChild[]) => RefSpec<TConfig['elements'][Tag]>;
  // Reactive element builder - tag can be dynamic or null for conditional rendering
  <Tag extends keyof TConfig['elements']>(
    reactive: Reactive<Tag | null>,
    props?: Record<string, unknown>
  ): (...children: ElRefSpecChild[]) => RefSpec<TConfig['baseElement']>;
}
