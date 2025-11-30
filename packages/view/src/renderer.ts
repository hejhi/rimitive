/**
 * TreeAdapter interface - abstracts tree manipulation for any node-based target
 *
 * This allows el() and map() to be pure reactive primitives that work
 * with any tree target (DOM, Three.js scene graph, etc.)
 *
 * The interface is intentionally minimal - just the core tree operations.
 * DOM-specific concerns (events, hydration) are layered on top.
 */

/**
 * Generic node interface - platform-agnostic
 * Adapters can extend this with their own node types
 */
export type Node = object;

/**
 * RendererConfig defines the type-level contract for a tree adapter:
 * - elements: Maps tag names to their node types (e.g., 'div' -> HTMLDivElement)
 * - events: Maps event names to their event object types (e.g., 'click' -> MouseEvent)
 * - baseElement: Base node type for this adapter (e.g., Node for DOM)
 *
 * Note: Text is just another node type created via createNode('text', { value: '...' })
 */
export interface RendererConfig {
  elements: object;
  events: object;
  baseElement: object;
}

/**
 * Renderer interface - core tree operations
 *
 * Generic over:
 * - TConfig: The renderer configuration (elements, events, baseElement)
 */
export interface Renderer<TConfig extends RendererConfig> {
  /**
   * Create a node with the given type
   *
   * For DOM: type is tag name ('div', 'span', 'text')
   * For Three.js: type is constructor name ('mesh', 'group')
   *
   * Text nodes are created with type 'text' and initial value in props:
   *   createNode('text', { value: 'hello' })
   */
  createNode: (type: string, props?: Record<string, unknown>) => TConfig['baseElement'];

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

  /**
   * Optional: Called when a node is attached to the tree
   */
  onAttach?: (node: TConfig['baseElement']) => void | (() => void);

  /**
   * Optional: Called when a node is detached from the tree
   */
  onDetach?: (node: TConfig['baseElement']) => void;

  // ============================================================================
  // Lifecycle Hooks
  //
  // These hooks allow renderers to intercept tree operations without polluting
  // the core interface with renderer-specific concerns (SSR, hydration, etc.)
  // ============================================================================

  /**
   * Optional: Called after an element is created and appended to its parent
   *
   * Use cases:
   * - SSR: Add island script tags after elements
   * - Hydration: No-op (elements already exist in DOM)
   *
   * @param elementRef - The element reference (unknown type to avoid circular deps)
   * @param parentElement - The parent element
   */
  onElementCreated?: (
    elementRef: unknown,
    parentElement: TConfig['baseElement']
  ) => void;

  /**
   * Optional: Called after a fragment ref is created (but before its content is attached)
   *
   * Use cases:
   * - SSR: No-op
   * - Hydration: Skip past fragment content in DOM to sync position for siblings
   *
   * @param fragmentRef - The fragment reference (unknown type to avoid circular deps)
   * @param parentElement - The parent element
   */
  onFragmentCreated?: (
    fragmentRef: unknown,
    parentElement: TConfig['baseElement']
  ) => void;

  /**
   * Optional: Called before a fragment's deferred content is attached
   *
   * Use cases:
   * - SSR: No-op
   * - Hydration: Seek to fragment position in DOM to sync position for content
   *
   * @param fragmentRef - The fragment reference
   * @param parentElement - The parent element
   * @param nextSibling - The next sibling element (or null if last)
   */
  beforeFragmentAttach?: (
    fragmentRef: unknown,
    parentElement: TConfig['baseElement'],
    nextSibling: TConfig['baseElement'] | null
  ) => void;

  /**
   * Optional: Called after a fragment's content has been attached
   *
   * Use cases:
   * - SSR: Add fragment boundary markers (comments) and island script tags
   * - Hydration: No-op
   *
   * @param fragmentRef - The fragment reference
   * @param parentElement - The parent element containing the fragment's children
   */
  afterFragmentAttach?: (
    fragmentRef: unknown,
    parentElement: TConfig['baseElement']
  ) => void;
}
