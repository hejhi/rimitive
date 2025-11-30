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

  /**
   * Optional: Add an event listener to a node (DOM-specific)
   * Returns a cleanup function to remove the listener
   */
  addEventListener?: <TOpts extends Record<string, unknown>>(
    element: TConfig['baseElement'],
    event: string,
    handler: (event: unknown) => void,
    options?: TOpts
  ) => () => void;

  /**
   * Optional: Decorate an element with SSR markers (e.g., island script tags)
   *
   * Called after an element has been created and attached to the DOM.
   * Used by SSR renderers to insert hydration markers
   * for island components. Not needed for client-side rendering.
   *
   * @param elementRef - The element reference (unknown type to avoid circular deps)
   * @param element - The actual DOM element
   */
  decorateElement?: (
    elementRef: unknown,
    element: TConfig['baseElement']
  ) => void;

  /**
   * Optional: Decorate a fragment with SSR markers (e.g., comment nodes)
   *
   * Called after a fragment's children have been attached to the DOM.
   * Used by SSR renderers (linkedom) to insert fragment boundary markers
   * for hydration. Not needed for client-side rendering.
   *
   * @param fragmentRef - The fragment reference (unknown type to avoid circular deps)
   * @param parentElement - The parent element containing the fragment's children
   */
  decorateFragment?: (
    fragmentRef: unknown,
    parentElement: TConfig['baseElement']
  ) => void;

  /**
   * Optional: Skip past fragment during forward pass
   *
   * Called by processChildren when encountering a FragmentRef during the forward
   * pass. Advances the hydrator's position past the fragment content so subsequent
   * siblings can be correctly matched.
   *
   * @param parent - The parent element containing the fragment
   * @param fragmentRef - The fragment reference (used to find fragment-end marker)
   */
  skipFragment?: (parent: TConfig['baseElement']) => void;

  /**
   * Optional: Seek to fragment position for deferred content hydration
   *
   * Called by fragment-creating primitives (show, map, match) during their
   * attach() phase, before creating deferred content. Allows the hydration
   * renderer to restore position to where the fragment's content exists in the DOM.
   *
   * Position is computed from DOM structure:
   * 1. Scan backwards from nextSibling to find fragment-start marker
   * 2. Count real children before marker to get content index
   * 3. Walk up DOM to compute path to parent
   *
   * @param parent - The parent element containing the fragment
   * @param nextSibling - The element that comes after this fragment (or null if last)
   */
  seekToFragment?: (
    parent: TConfig['baseElement'],
    nextSibling: TConfig['baseElement'] | null
  ) => void;
}
