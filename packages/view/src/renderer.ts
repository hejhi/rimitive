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
 * Generic comment node interface
 * Renderers can extend this with their own comment node types
 */
export type CommentNode = object;

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
  comment: object;
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
   * Create a comment node with initial data
   */
  createComment: (data: string) => TConfig['comment'];

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
    child: TConfig['baseElement'] | TConfig['textNode'] | TConfig['comment']
  ) => void;

  /**
   * Remove a child from a parent element
   */
  removeChild: (
    parent: TConfig['baseElement'],
    child: TConfig['baseElement'] | TConfig['textNode'] | TConfig['comment']
  ) => void;

  /**
   * Insert a child before a reference node
   */
  insertBefore: (
    parent: TConfig['baseElement'],
    child: TConfig['baseElement'] | TConfig['textNode'] | TConfig['comment'],
    reference: TConfig['baseElement'] | TConfig['textNode'] | TConfig['comment'] | null
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
   * Serialize an element to HTML string with custom children HTML
   *
   * @param element - The element to serialize
   * @param childrenHTML - The HTML string to use for children (instead of element's DOM children)
   * @returns HTML string representation of the element with the provided children
   */
  serializeElement: (
    element: TConfig['baseElement'],
    childrenHTML: string
  ) => string;
}
