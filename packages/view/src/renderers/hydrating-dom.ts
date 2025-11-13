/**
 * Hydrating DOM Renderer
 *
 * Returns existing DOM nodes instead of creating new ones.
 * Used during client-side hydration to match server-rendered HTML.
 *
 * Walks the DOM tree in parallel with component rendering,
 * returning nodes instead of creating them. If structure mismatches,
 * throws HydrationMismatch to trigger fallback to client-side rendering.
 */

import type { Renderer, RendererConfig } from '../renderer';

/**
 * Hydration mismatch error
 * Thrown when server-rendered HTML doesn't match client expectations
 */
export class HydrationMismatch extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HydrationMismatch';
  }
}

export interface DOMRendererConfig extends RendererConfig {
  elements: HTMLElementTagNameMap;
  events: HTMLElementEventMap;
  baseElement: HTMLElement;
  textNode: Text;
}

/**
 * Create a hydrating DOM renderer
 *
 * @param containerEl - Container element to hydrate (e.g., <div id="island-0">)
 * @returns Renderer that returns existing nodes instead of creating new ones
 *
 * @example
 * ```ts
 * const container = document.getElementById('counter-0');
 * const renderer = createHydratingDOMRenderer(container);
 *
 * // Component calls createElement('button')
 * // Renderer returns existing <button> from server HTML
 * const views = createSpec(renderer, signals);
 * const nodeRef = Counter(props).create(views);
 * ```
 */
export function createHydratingDOMRenderer(
  containerEl: HTMLElement
): Renderer<DOMRendererConfig> {
  // Cursor tracks current position in DOM tree
  let currentNode: Node | null = containerEl.firstChild;

  // Track parent context stack for proper nesting
  // When we enter an element, we push it. When we're done, we pop it.
  const parentStack: Array<{ parent: HTMLElement; nextNode: Node | null }> = [];

  // Track last parent to detect when we switch contexts
  let lastParent: HTMLElement | null = null;

  /**
   * Skip HTML comment nodes used as fragment boundaries
   * Comments like <!--fragment-start--> and <!--fragment-end--> mark
   * where fragments begin/end during SSR
   */
  const skipFragmentMarkers = () => {
    while (currentNode?.nodeType === 8) {
      // Node.COMMENT_NODE = 8
      const comment = currentNode as Comment;
      if (
        comment.textContent === 'fragment-start' ||
        comment.textContent === 'fragment-end'
      ) {
        currentNode = currentNode.nextSibling;
      } else {
        break;
      }
    }
  };

  return {
    /**
     * Return existing element and immediately enter it
     * Push current context onto stack so we can return to it later
     */
    createElement: (tag) => {
      skipFragmentMarkers();

      if (
        currentNode?.nodeType === 1 && // Node.ELEMENT_NODE = 1
        (currentNode as Element).tagName.toLowerCase() === tag.toLowerCase()
      ) {
        const node = currentNode as HTMLElement;
        // Save current position so we can return to it after processing children
        parentStack.push({ parent: node, nextNode: currentNode.nextSibling });
        // Enter this element to position cursor for its children
        currentNode = node.firstChild;
        skipFragmentMarkers();
        return node;
      }

      // Mismatch - but if cursor is null and we have lastParent, try advancing to next sibling
      // This handles fragment attachment in backward pass (e.g., map() creating sibling elements)
      if ((currentNode === null || currentNode === undefined) && lastParent) {
        // Try the next sibling of lastParent (for sequential fragment children)
        currentNode = lastParent.nextSibling;
        skipFragmentMarkers();

        // Retry matching after advancing to sibling
        if (
          currentNode?.nodeType === 1 &&
          (currentNode as Element).tagName.toLowerCase() === tag.toLowerCase()
        ) {
          const node = currentNode as HTMLElement;
          // Save position and enter the element
          parentStack.push({ parent: node, nextNode: currentNode.nextSibling });
          currentNode = node.firstChild;
          skipFragmentMarkers();
          return node;
        }
      }

      throw new HydrationMismatch(
        `Expected <${tag}>, got ${currentNode ? `<${(currentNode as Element).tagName}>` : 'null'}`
      );
    },

    /**
     * Return existing text node instead of creating new one
     * Updates text content if it differs (handles dynamic content)
     */
    createTextNode: (text) => {
      skipFragmentMarkers();

      if (currentNode?.nodeType === 3) {
        // Node.TEXT_NODE = 3
        const node = currentNode as Text;
        // Update text if it changed (e.g., data race between SSR and hydration)
        if (node.textContent !== text) {
          node.textContent = text;
        }
        currentNode = currentNode.nextSibling;
        return node;
      }

      throw new HydrationMismatch(
        `Expected text node, got ${currentNode?.nodeName || 'null'}`
      );
    },

    /**
     * Update text node content
     */
    updateTextNode: (node, text) => {
      node.textContent = text;
    },

    /**
     * Set attribute/property on element
     * Uses Reflect.set for property assignment (same as DOM renderer)
     */
    setAttribute: (element, key, value) => {
      Reflect.set(element, key, value);
    },

    /**
     * Track appendChild calls to manage cursor position
     *
     * Pop from stack when we're done with an element's children and
     * returning to its parent context
     */
    appendChild: (parent, child) => {
      // Check if we need to pop from stack (exiting child element context)
      while (parentStack.length > 0) {
        const top = parentStack[parentStack.length - 1]!;
        if (top.parent === parent) {
          // We're still in this parent's context, don't pop
          break;
        }
        // Pop - we've finished with this element's children
        const popped = parentStack.pop()!;
        currentNode = popped.nextNode;
        skipFragmentMarkers();
      }

      // Save previous parent for sibling advancement check
      const prevParent = lastParent;

      // Track the child element - it might need to be re-entered for fragments
      // This handles the case where a fragment's children are rendered in backward pass
      // Only track ELEMENT nodes (nodeType === 1), not text nodes
      if (child && typeof child === 'object' && 'nodeType' in child && (child as Node).nodeType === 1) {
        lastParent = child as HTMLElement;
      } else {
        lastParent = parent;
      }

      // Advance between siblings if same parent as before
      if (parent === prevParent && currentNode) {
        currentNode = currentNode.nextSibling;
        skipFragmentMarkers();
      }
      // Regular appendChild - no-op during hydration
    },

    /**
     * No-op during hydration - removal happens after hydration completes
     */
    removeChild: () => {},

    /**
     * No-op during hydration - elements already in correct positions
     */
    insertBefore: () => {},

    /**
     * Check if element is connected to DOM
     */
    isConnected: (element) => element.isConnected,

    /**
     * Attach event listeners to hydrated elements
     * This is where interactivity gets connected to existing DOM
     */
    addEventListener: (element, event, handler, options) => {
      element.addEventListener(event, handler, options);
      return () =>
        element.removeEventListener(
          event,
          handler,
          options as AddEventListenerOptions
        );
    },
  };
}
