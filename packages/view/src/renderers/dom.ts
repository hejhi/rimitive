/**
 * DOM Renderer - browser implementation
 */

import type { Renderer } from '../renderer';

/**
 * DOM-specific element type
 */
export type DOMElement = HTMLElement;

/**
 * DOM-specific text node type
 */
export type DOMTextNode = Text;

/**
 * Convenience type alias for DOM renderer element type
 * Use this to parameterize view factories for DOM
 */
export type DOM = DOMElement;

/**
 * Create a DOM renderer for browser environments
 */
export function createDOMRenderer(): Renderer<DOMElement, DOMTextNode> {
  return {
    createElement(tag: string): DOMElement {
      return document.createElement(tag);
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

    isConnected(element: DOMElement): boolean {
      return element.isConnected;
    },

    isElement(value: unknown): value is DOMElement {
      return value instanceof HTMLElement;
    },
  };
}
