/**
 * DOM Renderer - browser implementation
 */

import type { Renderer, LifecycleCallbacks } from '../renderer';
import { createLifecycleObserver } from './dom-lifecycle';

/**
 * DOM-specific element type
 */
export type DOMElement = HTMLElement;

/**
 * DOM-specific text node type
 */
export type DOMTextNode = Text;

/**
 * Shared lifecycle observer instance
 * PATTERN: Create once and reuse like signals context
 */
const lifecycleObserver = createLifecycleObserver();

/**
 * Create a DOM renderer for browser environments
 */
export function createDOMRenderer(): Renderer<DOMElement, DOMTextNode> {
  return {
    createElement(tag: string): DOMElement {
      return document.createElement(tag);
    },

    createContainer(): DOMElement {
      const container = document.createElement('div');
      container.style.display = 'contents';
      return container;
    },

    createTextNode(text: string): DOMTextNode {
      return document.createTextNode(text);
    },

    updateTextNode(node: DOMTextNode, text: string): void {
      node.textContent = text;
    },

    setAttribute(element: DOMElement, key: string, value: unknown): void {
      Reflect.set(element, key, value);
    },

    appendChild(parent: DOMElement, child: DOMElement | DOMTextNode): void {
      parent.appendChild(child as Node);
    },

    removeChild(parent: DOMElement, child: DOMElement | DOMTextNode): void {
      parent.removeChild(child as Node);
    },

    insertBefore(
      parent: DOMElement,
      child: DOMElement | DOMTextNode,
      reference: DOMElement | DOMTextNode | null
    ): void {
      parent.insertBefore(child as Node, reference as Node | null);
    },

    addEventListener(
      element: DOMElement,
      event: string,
      handler: (...args: unknown[]) => void
    ): () => void {
      element.addEventListener(event, handler);
      return () => element.removeEventListener(event, handler);
    },

    observeLifecycle(element: DOMElement, callbacks: LifecycleCallbacks<DOMElement>): () => void {
      const { onConnected, onDisconnected } = callbacks;

      // Set up observers using shared lifecycle observer
      const cleanupConnect = lifecycleObserver.observeConnection(element, onConnected);
      const cleanupDisconnect = lifecycleObserver.observeDisconnection(element, onDisconnected);

      // Return cleanup function
      return () => {
        cleanupConnect();
        cleanupDisconnect();
      };
    },

    isConnected(element: DOMElement): boolean {
      return element.isConnected;
    },

    isElement(value: unknown): value is DOMElement {
      return value instanceof HTMLElement;
    },

    isTextNode(value: unknown): value is DOMTextNode {
      return value instanceof Text;
    },
  };
}
