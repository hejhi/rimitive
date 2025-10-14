/**
 * Renderer interface - abstracts all platform-specific concerns
 *
 * This allows el() and elMap() to be pure reactive primitives that work
 * with any rendering target (DOM, SSR, React Native, etc.)
 */

/**
 * Generic element interface - platform-agnostic
 */
export interface Element {
  // Minimal interface - renderers can extend with their own types
}

/**
 * Generic text node interface
 */
export interface TextNode {
  // Minimal interface
}

/**
 * Lifecycle observation callbacks
 */
export interface LifecycleCallbacks<TElement extends Element = Element> {
  onConnected?: (element: TElement) => void | (() => void);
  onDisconnected?: (element: TElement) => void;
}

/**
 * Renderer interface - all platform-specific operations
 */
export interface Renderer<TElement extends Element = Element, TText extends TextNode = TextNode> {
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
  setAttribute(element: TElement, key: string, value: any): void;

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
   * Add an event listener to an element
   */
  addEventListener(element: TElement, event: string, handler: (...args: any[]) => void): () => void;

  /**
   * Observe element lifecycle (connection/disconnection from render tree)
   * Returns a cleanup function to stop observing
   */
  observeLifecycle(element: TElement, callbacks: LifecycleCallbacks<TElement>): () => void;

  /**
   * Check if an element is currently connected to the render tree
   */
  isConnected(element: TElement): boolean;

  /**
   * Check if a value is an element created by this renderer
   */
  isElement(value: any): value is TElement;

  /**
   * Check if a value is a text node created by this renderer
   */
  isTextNode(value: any): value is TText;
}
