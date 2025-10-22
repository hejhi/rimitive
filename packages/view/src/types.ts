/**
 * Core types for @lattice/view
 */

import type { Readable, ScheduledNode } from '@lattice/signals/types';

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
  attach: (
    parent: ElementRef<TElement>,
    nextSibling?: ElementRef<TElement> | null
  ) => void;
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
    if (current.status === STATUS_ELEMENT) return current.element;

    // FragmentRef - try to get first child element
    if (current.firstChild) {
      const firstChild = current.firstChild;

      // Check if firstChild is a ListItemNode (MapState case) - has .element and .key
      if ('element' in firstChild) return (firstChild as ElementRef<TElement>).element;
      else if (firstChild.status === STATUS_ELEMENT) return (firstChild as ElementRef<TElement>).element;
    }

    // Empty fragment - skip to next sibling
    current = current.next as NodeRef<TElement>;
  }
  return null; // End of chain
}

/**
 * Ref spec - a specification/blueprint for a ref that can be instantiated multiple times
 */
export interface RefSpec<TElement = ReactiveElement> {
  (lifecycleCallback: LifecycleCallback<TElement>): RefSpec<TElement>; // Register lifecycle callback (chainable)
  // Instantiate blueprint → creates DOM element with optional extensions
  create<TExt = Record<string, unknown>>(extensions?: TExt): NodeRef<TElement> & TExt;
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
  (
    parent: ElementRef<TElement>,
    nextSibling?: ElementRef<TElement> | null
  ): void;
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

/**
 * Valid child types for an element
 * Generic over element type for proper FragmentSpec typing
 */
export type ElRefSpecChild<TElement = object> =
  | string
  | number
  | boolean
  | null
  | RefSpec<TElement>
  | Reactive<unknown>
  | FragmentSpec<TElement>;

/**
 * ARCHITECTURE: RenderScope - Unified Reactive Render Node
 *
 * RenderScope unifies @lattice/signals' ScheduledNode with @lattice/view's Scope.
 * This creates a single node type that:
 * 1. Participates in the reactive dependency graph (via ScheduledNode)
 * 2. Manages view lifecycle and cleanup (via tree structure + disposables)
 * 3. Enables zero-allocation scheduling for view updates
 *
 * Design rationale:
 * - ScheduledNode provides: reactive tracking, scheduling queue participation, flush mechanism
 * - Scope provides: tree structure for parent-child relationships, disposable tracking
 * - Element binding: connects the node to its DOM element for updates
 *
 * This unification eliminates the need for separate "effect" and "scope" objects,
 * reducing allocations and indirection while maintaining clear separation of concerns.
 *
 * Key fields by responsibility:
 *
 * REACTIVE GRAPH (from ScheduledNode -> ConsumerNode -> ReactiveNode):
 * @property __type - Type brand for nominal typing (ReactiveNode)
 * @property status - Node status bits: CLEAN/PENDING/DIRTY/DISPOSED + type flags (ReactiveNode)
 * @property dependencies - Head of dependency list for tracking producers (ConsumerNode)
 * @property dependencyTail - Current tracking position in dependency list (ConsumerNode)
 * @property trackingVersion - Global version when last tracked (ConsumerNode)
 * @property nextScheduled - Next node in scheduling queue (ScheduledNode)
 * @property flush - Execute deferred render work (ScheduledNode)
 *
 * TREE STRUCTURE (from Scope):
 * @property parent - Parent scope in the tree hierarchy
 * @property firstChild - First child scope (intrusive linked list)
 * @property nextSibling - Next sibling scope (intrusive linked list)
 *
 * LIFECYCLE & CLEANUP (from Scope):
 * @property firstDisposable - Head of disposables linked list
 *
 * ELEMENT BINDING (view-specific):
 * @property element - The DOM element this scope is rendering to
 * @property cleanup - Optional cleanup function to run on disposal
 */
export interface RenderScope<TElement = ReactiveElement> extends ScheduledNode {
  // Tree structure (from Scope)
  parent: RenderScope<TElement> | undefined;
  firstChild: RenderScope<TElement> | undefined;
  nextSibling: RenderScope<TElement> | undefined;

  // Lifecycle & cleanup (from Scope)
  firstDisposable: DisposableNode | undefined;

  // Element binding (view-specific)
  element: TElement;
  cleanup?: () => void;

  // Reactive rendering (for effect-based scopes)
  renderFn?: () => void | (() => void);
}

/**
 * Wrapper for disposables to form linked list
 * Used by RenderScope to track cleanup functions
 */
export interface DisposableNode {
  disposable: Disposable;
  next: DisposableNode | undefined;
}

/**
 * Type guard to check if a value is a RenderScope
 * Useful for runtime checks when working with mixed node types
 */
export function isRenderScope<TElement = ReactiveElement>(
  value: unknown
): value is RenderScope<TElement> {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__type' in value &&
    (value as { __type: string }).__type === 'render-scope'
  );
}

