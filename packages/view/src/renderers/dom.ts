import type { Renderer, RendererConfig } from '../renderer';

export interface DOMRendererConfig extends RendererConfig {
  elements: HTMLElementTagNameMap;
  events: HTMLElementEventMap;
  baseElement: HTMLElement;
  textNode: Text;
  comment: Comment;
}

/**
 * Create a DOM renderer for browser environments
 */
export function createDOMRenderer(): Renderer<DOMRendererConfig> {
  return {
    createElement: (tag) => document.createElement(tag),
    createTextNode: (text) => document.createTextNode(text),
    createComment: (data) => document.createComment(data),
    updateTextNode: (node, text) => (node.textContent = text),
    setAttribute: (element, key, value) => {
      Reflect.set(element, key, value);
    },
    appendChild: (parent, child) => parent.appendChild(child),
    removeChild: (parent, child) => parent.removeChild(child),
    insertBefore: (parent, child, reference) => parent.insertBefore(child, reference),
    isConnected: (element) => element.isConnected,
    addEventListener: (element, event, handler, options?: AddEventListenerOptions) => {
      element.addEventListener(event, handler, options);
      return () => element.removeEventListener(event, handler, options as AddEventListenerOptions);
    },
  };
}
