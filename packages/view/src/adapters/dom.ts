import type { Adapter, AdapterConfig } from '../adapter';

export interface DOMAdapterConfig extends AdapterConfig {
  props: HTMLElementTagNameMap & { text: Text };
  elements: HTMLElementTagNameMap & { text: Text };
  events: HTMLElementEventMap;
  baseElement: Node;
}

/**
 * Create a DOM adapter for browser environments
 */
export function createDOMAdapter(): Adapter<DOMAdapterConfig> {
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
      // Use nodeType check instead of instanceof for test environment compatibility
      // (happy-dom's Text class is different from global Text)
      if (node.nodeType === 3) {
        if (key === 'value') {
          (node as Text).textContent = value != null ? String(value) : '';
        }
        return;
      }

      // Element nodes (nodeType === 1)
      if (node.nodeType === 1) {
        const element = node as Element;
        // Hyphenated keys (data-*, aria-*, custom attributes) use setAttribute
        // Everything else uses property assignment for proper type handling
        if (key.includes('-')) {
          if (value == null) {
            element.removeAttribute(key);
          } else {
            element.setAttribute(key, String(value));
          }
        } else {
          Reflect.set(element, key, value);
        }
      }
    },

    appendChild: (parent, child) => parent.appendChild(child),
    removeChild: (parent, child) => parent.removeChild(child),
    insertBefore: (parent, child, reference) =>
      parent.insertBefore(child, reference),
  };
}
