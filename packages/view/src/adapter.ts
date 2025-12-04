/**
 * Adapter type - abstracts tree manipulation for any node-based target
 *
 * This allows el() and map() to be pure reactive primitives that work
 * with any tree target (DOM, Three.js scene graph, etc.)
 *
 * The type is intentionally minimal - just the core tree operations.
 * DOM-specific concerns (events, hydration) are layered on top.
 */

import type { NodeRef, ParentContext } from './types';

/**
 * Generic node type - platform-agnostic
 * Adapters can extend this with their own node types
 */
export type Node = object;

/**
 * AdapterConfig defines the type-level contract for a tree adapter:
 * - props: Maps tag names to their prop types for el() autocomplete
 * - elements: Maps tag names to their node types for RefSpec<T> (e.g., 'div' -> HTMLDivElement)
 * - events: Maps event names to their event object types (e.g., 'click' -> MouseEvent)
 * - baseElement: Base node type for this adapter (e.g., Node for DOM)
 *
 * Separating `props` from `elements` allows adapters to have clean prop autocomplete
 * without exposing internal node properties (like canvas's bounds, dirty, etc).
 *
 * Note: Text is just another node type created via createNode('text', { value: '...' })
 */
export type AdapterConfig = {
  props: object;
  elements: object;
  events: object;
  baseElement: object;
};

/**
 * Adapter type - core tree operations
 *
 * Generic over:
 * - TConfig: The adapter configuration (elements, events, baseElement)
 *
 * ## Lifecycle Hooks
 *
 * The adapter supports six symmetric lifecycle hooks across three phases:
 *
 * | Phase   | Before         | After (on) |
 * |---------|----------------|------------|
 * | Create  | beforeCreate   | onCreate   |
 * | Attach  | beforeAttach   | onAttach   |
 * | Destroy | beforeDestroy  | onDestroy  |
 *
 * Node type (element vs fragment) is determined by `ref.status`:
 * - STATUS_ELEMENT (1): Element node with actual DOM element
 * - STATUS_FRAGMENT (2): Fragment node (logical container, no DOM element)
 *
 * ### Hydration
 *
 * For hydration-specific position tracking, use the HydrationAdapter extension
 * which adds `seekToPosition` and `skipContent` methods.
 */
export type Adapter<TConfig extends AdapterConfig> = {
  // ============================================================================
  // Core Tree Operations
  // ============================================================================

  /**
   * Create a node with the given type
   *
   * For DOM: type is tag name ('div', 'span', 'text')
   *
   * Text nodes are created with type 'text' and initial value in props:
   *   createNode('text', { value: 'hello' })
   *
   * For cross-renderer composition, parentContext provides the parent's renderer
   * and element, enabling renderers to make boundary decisions (e.g., canvas
   * renderer creating an HTMLCanvasElement when nested under a DOM parent).
   */
  createNode: (
    type: string,
    props?: Record<string, unknown>,
    parentContext?: ParentContext<unknown>
  ) => TConfig['baseElement'];

  /**
   * Set a property on a node
   *
   * For text nodes, setting 'value' updates the text content
   */
  setProperty: (
    node: TConfig['baseElement'],
    key: string,
    value: unknown
  ) => void;

  /**
   * Append a child to a parent node
   */
  appendChild: (
    parent: TConfig['baseElement'],
    child: TConfig['baseElement']
  ) => void;

  /**
   * Remove a child from a parent node
   */
  removeChild: (
    parent: TConfig['baseElement'],
    child: TConfig['baseElement']
  ) => void;

  /**
   * Insert a child before a reference node
   */
  insertBefore: (
    parent: TConfig['baseElement'],
    child: TConfig['baseElement'],
    reference: TConfig['baseElement'] | null
  ) => void;

  // ============================================================================
  // Lifecycle Hooks
  //
  // Symmetric hooks for create, attach, and destroy phases.
  // Node type is determined by ref.status (STATUS_ELEMENT or STATUS_FRAGMENT).
  // ============================================================================

  /**
   * Called before a node is created
   *
   * Use cases:
   * - Hydration: Prepare position tracking before node creation
   *
   * @param type - The node type being created ('div', 'text', etc.)
   * @param props - Initial properties for the node
   */
  beforeCreate?: (type: string, props?: Record<string, unknown>) => void;

  /**
   * Called after a node ref is created
   *
   * Use cases:
   * - SSR: Add island script tags after elements
   * - Hydration: Skip past fragment content to sync position for siblings
   *
   * @param ref - The node reference (element or fragment, check ref.status)
   * @param parent - The parent element
   */
  onCreate?: (
    ref: NodeRef<TConfig['baseElement']>,
    parent: TConfig['baseElement']
  ) => void;

  /**
   * Called before a node's content is attached to the tree
   *
   * For elements: Called before the element is inserted into the DOM
   * For fragments: Called before fragment's deferred content is attached
   *
   * Use cases:
   * - Hydration: Seek to correct position in DOM before attaching content
   *
   * @param ref - The node reference
   * @param parent - The parent element
   * @param nextSibling - The next sibling element (or null if last)
   */
  beforeAttach?: (
    ref: NodeRef<TConfig['baseElement']>,
    parent: TConfig['baseElement'],
    nextSibling: TConfig['baseElement'] | null
  ) => void;

  /**
   * Called after a node's content has been attached to the tree
   *
   * For elements: Called after the element is inserted into the DOM
   * For fragments: Called after fragment's content has been attached
   *
   * Use cases:
   * - SSR: Add fragment boundary markers (comments) and island script tags
   * - Lifecycle callbacks: Trigger onConnect callbacks
   *
   * @param ref - The node reference
   * @param parent - The parent element
   */
  onAttach?: (
    ref: NodeRef<TConfig['baseElement']>,
    parent: TConfig['baseElement']
  ) => void;

  /**
   * Called before a node is removed from the tree
   *
   * Use cases:
   * - Animation: Trigger exit animations before removal
   * - Cleanup: Perform cleanup before node is detached
   *
   * @param ref - The node reference
   * @param parent - The parent element
   */
  beforeDestroy?: (
    ref: NodeRef<TConfig['baseElement']>,
    parent: TConfig['baseElement']
  ) => void;

  /**
   * Called after a node has been removed from the tree and disposed
   *
   * Use cases:
   * - Cleanup: Final cleanup after node is fully removed
   * - Logging: Track node removal
   *
   * @param ref - The node reference
   * @param parent - The parent element (may no longer contain node)
   */
  onDestroy?: (
    ref: NodeRef<TConfig['baseElement']>,
    parent: TConfig['baseElement']
  ) => void;
};
