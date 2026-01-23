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
 *
 * @example
 * ```typescript
 * import type { Node } from '@rimitive/view/adapter';
 *
 * // DOM adapter uses HTMLElement as Node
 * type DOMNode = HTMLElement & Node;
 *
 * // Canvas adapter might use a custom node type
 * type CanvasNode = { type: 'rect' | 'circle'; x: number; y: number } & Node;
 * ```
 */
export type Node = object;

/**
 * TreeConfig defines the type-level contract for a tree adapter:
 * - attributes: Maps tag names to their attribute types for el() autocomplete
 * - nodes: Maps tag names to their node types for RefSpec\<T\> (e.g., 'div' -\> HTMLDivElement)
 *
 * The base node type is derived automatically as the union of all node types in `nodes`.
 * Use `NodeOf<TConfig>` to access it.
 *
 * Separating `attributes` from `nodes` allows adapters to have clean attribute autocomplete
 * without exposing internal node properties (like canvas's bounds, dirty, etc).
 *
 * Note: Text is just another node type created via createNode('text', \{ value: '...' \})
 *
 * @example
 * ```typescript
 * import type { TreeConfig, NodeOf } from '@rimitive/view/adapter';
 *
 * // DOM tree config
 * type DOMTreeConfig = TreeConfig & {
 *   attributes: {
 *     div: { className?: string; id?: string };
 *     button: { disabled?: boolean; textContent?: string };
 *   };
 *   nodes: {
 *     div: HTMLDivElement;
 *     button: HTMLButtonElement;
 *     text: Text;
 *   };
 * };
 *
 * // Base node type is derived: HTMLDivElement | HTMLButtonElement | Text
 * type DOMNode = NodeOf<DOMTreeConfig>;
 * ```
 */
export type TreeConfig = {
  attributes: Record<string, object>;
  nodes: Record<string, object>;
};

/**
 * Get a specific node type from the config's nodes map.
 *
 * @example
 * ```typescript
 * type DivElement = NodeType<DOMTreeConfig, 'div'>; // HTMLDivElement
 * type TextNode = NodeType<DOMTreeConfig, 'text'>; // Text
 * ```
 */
export type NodeType<
  TConfig extends TreeConfig,
  K extends keyof TConfig['nodes'],
> = TConfig['nodes'][K];

/**
 * Union of all node types in the config.
 * Used for adapter method parameters where any node type is accepted.
 *
 * @example
 * ```typescript
 * type AnyDOMNode = NodeOf<DOMTreeConfig>; // HTMLDivElement | HTMLSpanElement | ... | Text
 * ```
 */
export type NodeOf<TConfig extends TreeConfig> =
  TConfig['nodes'][keyof TConfig['nodes']];

/**
 * Adapter type - core tree operations
 *
 * Generic over:
 * - TConfig: The tree configuration (nodes, attributes, node)
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
 * - STATUS_ELEMENT (1): Element node with actual tree node
 * - STATUS_FRAGMENT (2): Fragment node (logical container, no tree node)
 *
 * ### Hydration
 *
 * For hydration-specific position tracking, use the HydrationAdapter extension
 * which adds `seekToPosition` and `skipContent` methods.
 *
 * @example
 * ```typescript
 * import type { Adapter, TreeConfig } from '@rimitive/view/adapter';
 *
 * const domAdapter: Adapter<DOMTreeConfig> = {
 *   createNode: (type, props) => {
 *     if (type === 'text') return document.createTextNode(props?.value as string || '');
 *     return document.createElement(type);
 *   },
 *   setAttribute: (node, key, value) => {
 *     if (key === 'textContent') node.textContent = value as string;
 *     else (node as HTMLElement).setAttribute(key, String(value));
 *   },
 *   appendChild: (parent, child) => parent.appendChild(child),
 *   removeChild: (parent, child) => parent.removeChild(child),
 *   insertBefore: (parent, child, ref) => parent.insertBefore(child, ref),
 * };
 * ```
 */
export type Adapter<TConfig extends TreeConfig> = {
  // ============================================================================
  // Core Tree Operations
  // ============================================================================

  /**
   * Create a node with the given type
   *
   * For DOM: type is tag name ('div', 'span', 'text')
   *
   * Text nodes are created with type 'text' and initial value in props:
   *   createNode('text', \{ value: 'hello' \})
   *
   * For cross-renderer composition, parentContext provides the parent's renderer
   * and element, enabling renderers to make boundary decisions (e.g., canvas
   * renderer creating an HTMLCanvasElement when nested under a DOM parent).
   *
   * Returns the specific node type for the given tag (e.g., 'div' -> HTMLDivElement).
   * Implementations should cast their return values to satisfy the type.
   */
  createNode: <K extends keyof TConfig['nodes'] & string>(
    type: K,
    props?: Record<string, unknown>,
    parentContext?: ParentContext<unknown>
  ) => TConfig['nodes'][K];

  /**
   * Set a property on a node
   *
   * For text nodes, setting 'value' updates the text content
   */
  setAttribute: (node: NodeOf<TConfig>, key: string, value: unknown) => void;

  /**
   * Append a child to a parent node
   */
  appendChild: (parent: NodeOf<TConfig>, child: NodeOf<TConfig>) => void;

  /**
   * Remove a child from a parent node
   */
  removeChild: (parent: NodeOf<TConfig>, child: NodeOf<TConfig>) => void;

  /**
   * Insert a child before a reference node
   */
  insertBefore: (
    parent: NodeOf<TConfig>,
    child: NodeOf<TConfig>,
    reference: NodeOf<TConfig> | null
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
  onCreate?: (ref: NodeRef<NodeOf<TConfig>>, parent: NodeOf<TConfig>) => void;

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
    ref: NodeRef<NodeOf<TConfig>>,
    parent: NodeOf<TConfig>,
    nextSibling: NodeOf<TConfig> | null
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
  onAttach?: (ref: NodeRef<NodeOf<TConfig>>, parent: NodeOf<TConfig>) => void;

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
    ref: NodeRef<NodeOf<TConfig>>,
    parent: NodeOf<TConfig>
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
  onDestroy?: (ref: NodeRef<NodeOf<TConfig>>, parent: NodeOf<TConfig>) => void;
};
