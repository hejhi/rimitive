/**
 * Core types for @rimitive/view
 */

// Re-export adapter types so they're available from @rimitive/view/types
export type { Adapter, TreeConfig, NodeOf, NodeType } from './adapter';

// Re-export factory types for public service
export type { PortalFactory, PortalTarget, PortalOpts } from './portal';
export type { MapFactory } from './map';
export type { MatchFactory } from './match';
export type { ErrorBoundaryFactory } from './error-boundary';

/**
 * Parent context passed to RefSpec.create() for adapter composition
 * Allows child RefSpecs to know their parent's adapter and element
 *
 * Note: adapter uses 'unknown' for variance - any Adapter<T> is assignable
 *
 * @example
 * ```typescript
 * import type { ParentContext } from '@rimitive/view/types';
 *
 * const context: ParentContext<HTMLElement> = {
 *   adapter: domAdapter,
 *   element: parentElement
 * };
 *
 * // Used internally when creating child elements
 * const childRef = childSpec.create(svc, {}, context);
 * ```
 */
export type ParentContext<TElement> = {
  /** The parent's adapter - enables cross-adapter composition */
  adapter: unknown;
  /** The parent element (already created when children are processed) */
  element: TElement;
};

/**
 * Status bits for node ref type discrimination
 * Using powers of 2 for bitwise operations
 */
export const STATUS_ELEMENT = 1; // 0001
export const STATUS_FRAGMENT = 2; // 0010
export const STATUS_REF_SPEC = 4; // 0100
export const STATUS_COMMENT = 16; // 10000

/**
 * Composite bit masks for checking types
 */
export const STATUS_NODE_MASK = STATUS_ELEMENT | STATUS_FRAGMENT; // 0011 (3)
export const STATUS_SPEC_MASK = STATUS_REF_SPEC; // 0100 (4)

export type BaseRef = {
  status: number;
};

/**
 * Linked nodes - nodes that form doubly-linked lists
 * Elements are actual DOM nodes in the list
 * Fragments are logical nodes that own their own child lists
 */
export type LinkedNode<TElement> = ElementRef<TElement> | FragmentRef<TElement>;

/**
 * Element ref node - wraps created elements for tree structure
 * Forms doubly-linked list with prev/next pointers for efficient sibling traversal
 * Links to parent for tree traversal
 * Tracks child NodeRefs for tree walking (needed for SSR fragment detection)
 */
export type ElementRef<TElement> = BaseRef & {
  status: typeof STATUS_ELEMENT;
  element: TElement;
  parent: ElementRef<TElement> | null; // Parent element in tree
  prev: LinkedNode<TElement> | null; // Previous sibling in doubly-linked list
  next: LinkedNode<TElement> | null; // Next sibling in doubly-linked list

  // Child list (nodes within this element) - using LinkedNode for fragments
  firstChild: LinkedNode<TElement> | null;
  lastChild: LinkedNode<TElement> | null;
};

/**
 * Fragment ref node - logical container in the tree (no DOM element)
 * Fragments participate in parent's doubly-linked list and own their own child list
 */
export type FragmentRef<TElement> = BaseRef & {
  status: typeof STATUS_FRAGMENT;
  element: null;

  // Position in parent's doubly-linked list
  // Uses 'unknown' for variance - allows FragmentRef<T> to be assignable to FragmentRef<unknown>
  parent: ElementRef<TElement> | null;
  prev: NodeRef<TElement> | null;
  next: NodeRef<TElement> | null;

  // Own child list (nodes within this fragment)
  firstChild: LinkedNode<TElement> | null;
  lastChild: LinkedNode<TElement> | null;

  // Cleanup function returned by attach() - called when fragment is removed
  // Stored by insertNodeBefore, called by removeNode
  cleanup?: () => void;

  // Attach method - called when fragment is attached to the tree
  // Method syntax (not property) is bivariant, allowing proper typing while maintaining variance
  attach(
    parent: ElementRef<TElement>,
    nextSibling: NodeRef<TElement> | null,
    svc?: unknown
  ): void | (() => void);
};

/**
 * Ref node - union of element/fragment tracking nodes
 */
export type NodeRef<TElement> = ElementRef<TElement> | FragmentRef<TElement>;

/**
 * Ref spec - a specification/blueprint for a ref that can be instantiated multiple times
 * Extends Service to provide uniform context injection pattern
 *
 * @example
 * ```typescript
 * import { compose } from '@rimitive/core';
 * import { SignalModule } from '@rimitive/signals/extend';
 * import { createDOMAdapter } from '@rimitive/view/adapters/dom';
 * import { createElModule } from '@rimitive/view/el';
 * import type { RefSpec } from '@rimitive/view/types';
 *
 * const adapter = createDOMAdapter();
 * const svc = compose(SignalModule, createElModule(adapter));
 * const { el, mount } = svc;
 *
 * // el() returns a RefSpec
 * const buttonSpec: RefSpec<HTMLButtonElement> = el('button')('Click me');
 *
 * // RefSpecs can be instantiated multiple times
 * const button1 = mount(buttonSpec);
 * const button2 = mount(buttonSpec);
 * ```
 */
export type RefSpec<TElement> = {
  status: typeof STATUS_REF_SPEC;
  // Instantiate blueprint → creates DOM element with optional extensions
  // svc parameter is optional - only needed for components created with create()
  // parentContext enables cross-renderer composition (e.g., canvas inside DOM)
  create<TExt = Record<string, unknown>>(
    svc?: unknown,
    extensions?: TExt,
    parentContext?: ParentContext<unknown>
  ): NodeRef<TElement> & TExt;
};

import type { Reactive } from '@rimitive/signals/types';
/**
 * Portable signal types - re-exported from @rimitive/signals
 */
export type { Readable, Writable, Reactive } from '@rimitive/signals/types';

/**
 * Lifecycle callback for element connection/disconnection
 *
 * @example
 * ```typescript
 * import { compose } from '@rimitive/core';
 * import { createDOMAdapter } from '@rimitive/view/adapters/dom';
 * import { createElModule } from '@rimitive/view/el';
 * import type { LifecycleCallback } from '@rimitive/view/types';
 *
 * const adapter = createDOMAdapter();
 * const svc = compose(createElModule(adapter));
 * const { el } = svc;
 *
 * // Simple callback
 * const autofocus: LifecycleCallback<HTMLInputElement> = (elem) => {
 *   elem.focus();
 * };
 *
 * // Callback with cleanup
 * const trackResize: LifecycleCallback<HTMLElement> = (elem) => {
 *   const observer = new ResizeObserver(() => console.log('resized'));
 *   observer.observe(elem);
 *   return () => observer.disconnect();
 * };
 *
 * el('input').ref(autofocus, trackResize)();
 * ```
 */
export type LifecycleCallback<TElement> = (
  element: TElement
) => void | (() => void);

/**
 * Valid child types for an element
 *
 * Note: Bare functions are not supported. For dynamic content, use map() or other
 * reconciliation helpers that provide efficient updates.
 *
 * The TElement parameter is kept for API consistency, but child RefSpecs/FragmentRefs
 * use `unknown` since any element can be a child of any other element at runtime. Using `unknown`
 * (the top type) allows proper variance - any RefSpec<T> is assignable to RefSpec<unknown>.
 *
 * @example
 * ```typescript
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule } from '@rimitive/signals/extend';
 * import { createDOMAdapter } from '@rimitive/view/adapters/dom';
 * import { createElModule } from '@rimitive/view/el';
 * import type { ElRefSpecChild } from '@rimitive/view/types';
 *
 * const adapter = createDOMAdapter();
 * const svc = compose(SignalModule, ComputedModule, createElModule(adapter));
 * const { el, signal, computed } = svc;
 * const name = signal('World');
 *
 * // All valid children types
 * const children: ElRefSpecChild[] = [
 *   'Hello',                              // string
 *   42,                                    // number
 *   true,                                  // boolean
 *   null,                                  // null (renders nothing)
 *   el('span')('text'),                    // RefSpec
 *   computed(() => `Hello, ${name()}!`),   // Reactive
 * ];
 *
 * el('div')(...children);
 * ```
 */
export type ElRefSpecChild =
  | string
  | number
  | boolean
  | null
  | RefSpec<unknown>
  | Reactive<unknown>
  | FragmentRef<unknown>;

export type RenderScope<TElement> = {
  // Type marker
  __type: string;

  // Status for tracking disposal state
  status: number;

  // Tree structure (from Scope) - intrusive singly-linked tree
  firstChild: RenderScope<TElement> | undefined;
  nextSibling: RenderScope<TElement> | undefined;

  // Lifecycle & cleanup (from Scope)
  firstDisposable: DisposableNode | undefined;

  // Element binding (view-specific)
  element: TElement;
};

/**
 * Linked list node for tracking dispose functions
 * Used by RenderScope to track cleanup functions
 */
export type DisposableNode = {
  dispose: () => void;
  next: DisposableNode | undefined;
};
