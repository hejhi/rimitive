/**
 * Renderer interface - abstracts all platform-specific concerns
 *
 * This allows el() and map() to be pure reactive primitives that work
 * with any rendering target (DOM, SSR, React Native, etc.)
 */

/**
 * Generic element interface - platform-agnostic
 * Renderers can extend this with their own element types
 */
export type Element = object;

/**
 * Generic text node interface
 * Renderers can extend this with their own text node types
 */
export type TextNode = object;

/**
 * RendererConfig defines the type-level contract for a renderer:
 * - elements: Maps tag names to their element types (e.g., 'div' -> HTMLDivElement)
 * - events: Maps event names to their event object types (e.g., 'click' -> MouseEvent)
 * - baseElement: Base element type for this renderer (e.g., HTMLElement)
 * - textNode: Text node type for this renderer (e.g., Text)
 * - comment: Comment node type for this renderer (e.g., Comment)
 *
 * This allows the type system to provide full type safety while keeping
 * the renderer implementation simple and agnostic.
 */
export interface RendererConfig {
  elements: object;
  events: object;
  baseElement: object;
  textNode: object;
}

/**
 * Renderer interface - all platform-specific operations
 *
 * Generic over:
 * - TConfig: The renderer configuration (elements, events, baseElement, textNode)
 */
export interface Renderer<TConfig extends RendererConfig> {
  /**
   * Create an element with the given tag name
   */
  createElement: (tag: string) => TConfig['baseElement'];

  /**
   * Create a text node with initial content
   */
  createTextNode: (text: string) => TConfig['textNode'];

  /**
   * Update a text node's content
   */
  updateTextNode: (node: TConfig['textNode'], text: string) => void;

  /**
   * Set an attribute/property on an element
   */
  setAttribute: (
    element: TConfig['baseElement'],
    key: string,
    value: unknown
  ) => void;

  /**
   * Append a child to a parent element
   */
  appendChild: (
    parent: TConfig['baseElement'],
    child: TConfig['baseElement'] | TConfig['textNode']
  ) => void;

  /**
   * Remove a child from a parent element
   */
  removeChild: (
    parent: TConfig['baseElement'],
    child: TConfig['baseElement'] | TConfig['textNode']
  ) => void;

  /**
   * Insert a child before a reference node
   */
  insertBefore: (
    parent: TConfig['baseElement'],
    child: TConfig['baseElement'] | TConfig['textNode'],
    reference: TConfig['baseElement'] | TConfig['textNode'] | null
  ) => void;

  /**
   * Check if an element is currently connected to the render tree
   */
  isConnected: (element: TConfig['baseElement']) => boolean;

  /**
   * Add an event listener to an element
   * Returns a cleanup function to remove the listener
   *
   * Implementation note: The runtime implementation uses string for event name
   * and unknown for handler, but the type system constrains these based on TConfig
   */
  addEventListener: <TOpts extends Record<string, unknown>>(
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
