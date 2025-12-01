import type { Renderer, RendererConfig } from '../renderer';

export interface DOMRendererConfig extends RendererConfig {
  props: HTMLElementTagNameMap & { text: Text };
  elements: HTMLElementTagNameMap & { text: Text };
  events: HTMLElementEventMap;
  baseElement: Node;
}

/**
 * Create a DOM renderer for browser environments
 */
export function createDOMRenderer(): Renderer<DOMRendererConfig> {
  return {
    createNode: (type, props) => {
      if (type === 'text') {
        return document.createTextNode(
          props?.value != null ? String(props.value) : ''
        );
      }
      return document.createElement(type);
    },

    setProperty: (node, key, value) => {
      // Text nodes only support 'value' -> textContent
      if (node instanceof Text) {
        if (key === 'value') {
          node.textContent = value != null ? String(value) : '';
        }
        return;
      }

      // Element nodes
      if (node instanceof Element) {
        // Hyphenated keys (data-*, aria-*, custom attributes) use setAttribute
        // Everything else uses property assignment for proper type handling
        if (key.includes('-')) {
          if (value == null) {
            node.removeAttribute(key);
          } else {
            node.setAttribute(key, String(value));
          }
        } else {
          Reflect.set(node, key, value);
        }
      }
    },

    appendChild: (parent, child) => parent.appendChild(child),
    removeChild: (parent, child) => parent.removeChild(child),
    insertBefore: (parent, child, reference) =>
      parent.insertBefore(child, reference),
  };
}
