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
 *
 * This allows the type system to provide full type safety while keeping
 * the renderer implementation simple and agnostic.
 */
export interface RendererConfig {
  elements: object;
  events: object;
}

/**
 * Extract the config from a Renderer type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InferConfig<R> = R extends Renderer<infer C, any, any> ? C : never;

/**
 * Renderer interface - all platform-specific operations
 *
 * Generic over:
 * - TConfig: The renderer configuration (elements, events)
 * - TElement: Base element type for this renderer
 * - TText: Text node type for this renderer
 */
export interface Renderer<
  TConfig extends RendererConfig,
  TElement extends Element = Element,
  TText extends TextNode = TextNode
> {
  /**
   * Phantom type to carry renderer configuration
   * This is never set at runtime - it exists purely for type inference
   */
  readonly _config?: TConfig;
  /**
   * Create an element with the given tag name
   */
  createElement(tag: string): TElement;

  /**
   * Create a text node with initial content
   */
  createTextNode(text: string): TText;

  /**
   * Update a text node's content
   */
  updateTextNode(node: TText, text: string): void;

  /**
   * Set an attribute/property on an element
   */
  setAttribute(element: TElement, key: string, value: unknown): void;

  /**
   * Append a child to a parent element
   */
  appendChild(parent: TElement, child: Element | TText): void;

  /**
   * Remove a child from a parent element
   */
  removeChild(parent: TElement, child: Element | TText): void;

  /**
   * Insert a child before a reference node
   */
  insertBefore(parent: TElement, child: Element | TText, reference: Element | TText | null): void;

  /**
   * Check if an element is currently connected to the render tree
   */
  isConnected(element: TElement): boolean;

  /**
   * Check if a value is an element created by this renderer
   */
  isElement(value: unknown): value is TElement;

  /**
   * Add an event listener to an element
   * Returns a cleanup function to remove the listener
   *
   * Implementation note: The runtime implementation uses string for event name
   * and unknown for handler, but the type system constrains these based on TConfig
   */
  addEventListener(
    element: TElement,
    event: string,
    handler: (event: unknown) => void,
    options?: unknown
  ): () => void;
}
