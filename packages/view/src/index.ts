/**
 * @lattice/view - Reactive DOM primitives
 *
 * Export main factories and types for building reactive UIs
 */

// Core primitives
export { createElFactory } from './el';
export { createElMapFactory } from './elMap';

// Context
export { createViewContext } from './context';
export type { ViewContext } from './context';

// Renderer
export type { Renderer, LifecycleCallbacks, Element, TextNode } from './renderer';

// Types
export type {
  ElementSpec,
  ElementProps,
  ElementChild,
  ElementRef,
  Reactive,
  ReactiveList,
  LifecycleCallback,
  Disposable,
} from './types';
export { isReactive, isReactiveList, isElementRef } from './types';

// Helpers
export { createScope, runInScope, disposeScope, trackInScope, trackInSpecificScope } from './helpers/scope';
export type { Scope } from './helpers/scope';
