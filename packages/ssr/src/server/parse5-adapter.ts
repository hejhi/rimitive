/**
 * Parse5 Adapter
 *
 * A lightweight SSR adapter using parse5's AST directly.
 * Works with plain objects instead of DOM methods for better performance.
 *
 * Supports Declarative Shadow DOM serialization.
 */

import {
  serializeOuter,
  serialize,
  type DefaultTreeAdapterTypes,
  type Token,
} from 'parse5';
import type { Adapter, TreeConfig } from '@rimitive/view/adapter';
import type { FragmentRef, NodeRef, ParentContext } from '@rimitive/view/types';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@rimitive/view/types';
import { isAsyncFragment } from '@rimitive/view/load';

// =============================================================================
// Namespace Constants
// =============================================================================

const NS_HTML = 'http://www.w3.org/1999/xhtml';
const NS_SVG = 'http://www.w3.org/2000/svg';

// =============================================================================
// Parse5 Node Types
// =============================================================================

/**
 * Attribute type from parse5
 */
type Attribute = Token.Attribute;

/**
 * Parse5 Element - the core node type for elements
 */
export type Parse5Element = DefaultTreeAdapterTypes.Element;

/**
 * Parse5 Text Node
 */
export type Parse5TextNode = DefaultTreeAdapterTypes.TextNode;

/**
 * Parse5 Comment Node
 */
export type Parse5CommentNode = DefaultTreeAdapterTypes.CommentNode;

/**
 * Parse5 Template - special element with content fragment
 */
export type Parse5Template = DefaultTreeAdapterTypes.Template;

/**
 * Parse5 DocumentFragment
 */
export type Parse5DocumentFragment = DefaultTreeAdapterTypes.DocumentFragment;

/**
 * Union of all parse5 node types we create
 */
export type Parse5Node = Parse5Element | Parse5TextNode | Parse5CommentNode;

/**
 * Tree config for parse5 adapter
 * Uses a simplified type map since parse5 nodes are plain objects
 */
export type Parse5TreeConfig = TreeConfig & {
  attributes: Record<string, Record<string, unknown>>;
  nodes: {
    text: Parse5TextNode;
    [key: string]: Parse5Element | Parse5TextNode;
  };
};

// =============================================================================
// Node Creation Helpers
// =============================================================================

/**
 * Create a parse5 Element node
 */
function createElement(
  tagName: string,
  namespaceURI: string = NS_HTML
): Parse5Element {
  return {
    nodeName: tagName,
    tagName,
    attrs: [],
    namespaceURI: namespaceURI as Parse5Element['namespaceURI'],
    parentNode: null,
    childNodes: [],
  };
}

/**
 * Create a parse5 TextNode
 */
function createTextNode(value: string): Parse5TextNode {
  return {
    nodeName: '#text',
    parentNode: null,
    value,
  };
}

/**
 * Create a parse5 CommentNode
 */
function createCommentNode(data: string): Parse5CommentNode {
  return {
    nodeName: '#comment',
    parentNode: null,
    data,
  };
}

/**
 * Create a parse5 DocumentFragment
 */
function createDocumentFragment(): Parse5DocumentFragment {
  return {
    nodeName: '#document-fragment',
    childNodes: [],
  };
}

/**
 * Create a Declarative Shadow DOM template element
 *
 * Creates a <template shadowrootmode="open|closed"> element
 * that parse5 will serialize correctly for DSD.
 */
function createDSDTemplate(
  mode: 'open' | 'closed',
  delegatesFocus?: boolean
): Parse5Template {
  const attrs: Attribute[] = [{ name: 'shadowrootmode', value: mode }];

  if (delegatesFocus) {
    attrs.push({ name: 'shadowrootdelegatesfocus', value: '' });
  }

  return {
    nodeName: 'template',
    tagName: 'template',
    attrs,
    namespaceURI: NS_HTML as Parse5Element['namespaceURI'],
    parentNode: null,
    childNodes: [],
    content: createDocumentFragment(),
  };
}

// =============================================================================
// Tree Operations
// =============================================================================

/**
 * Check if a node is an element (has childNodes)
 */
function isElement(node: Parse5Node): node is Parse5Element {
  return 'childNodes' in node;
}

/**
 * Append a child to a parent element
 */
function appendChild(parent: Parse5Element, child: Parse5Node): void {
  child.parentNode = parent;
  parent.childNodes.push(child);
}

/**
 * Remove a child from a parent element
 */
function removeChild(parent: Parse5Element, child: Parse5Node): void {
  const index = parent.childNodes.indexOf(child);
  if (index !== -1) {
    parent.childNodes.splice(index, 1);
    child.parentNode = null;
  }
}

/**
 * Insert a child before a reference node
 */
function insertBefore(
  parent: Parse5Element,
  child: Parse5Node,
  reference: Parse5Node | null
): void {
  child.parentNode = parent;
  if (reference === null) {
    parent.childNodes.push(child);
  } else {
    const index = parent.childNodes.indexOf(reference);
    if (index !== -1) {
      parent.childNodes.splice(index, 0, child);
    } else {
      parent.childNodes.push(child);
    }
  }
}

/**
 * Get next sibling of a node
 */
function getNextSibling(node: Parse5Node): Parse5Node | null {
  const parent = node.parentNode;
  if (!parent) return null;
  const index = parent.childNodes.indexOf(node);
  if (index === -1 || index === parent.childNodes.length - 1) return null;
  return parent.childNodes[index + 1] as Parse5Node;
}

// =============================================================================
// Attribute Handling
// =============================================================================

/**
 * Set an attribute on an element
 */
function setAttribute(
  element: Parse5Element,
  name: string,
  value: string
): void {
  const existing = element.attrs.find((attr: Attribute) => attr.name === name);
  if (existing) existing.value = value;
  else element.attrs.push({ name, value });
}

/**
 * Remove an attribute from an element
 */
function removeAttribute(element: Parse5Element, name: string): void {
  const index = element.attrs.findIndex(
    (attr: Attribute) => attr.name === name
  );
  if (index !== -1) element.attrs.splice(index, 1);
}

// =============================================================================
// Fragment Marker Utilities
// =============================================================================

/**
 * Get the first DOM node from a NodeRef (iteratively traversing nested fragments)
 */
function getFirstNode(nodeRef: NodeRef<unknown>): Parse5Node | null {
  let current: NodeRef<unknown> | null = nodeRef;
  while (current) {
    if (current.status === STATUS_ELEMENT) return current.element as Parse5Node;
    if (current.status === STATUS_FRAGMENT) current = current.firstChild;
    else break;
  }
  return null;
}

/**
 * Get the last DOM node from a NodeRef (iteratively traversing nested fragments)
 */
function getLastNode(nodeRef: NodeRef<unknown>): Parse5Node | null {
  let current: NodeRef<unknown> | null = nodeRef;
  while (current) {
    if (current.status === STATUS_ELEMENT) return current.element as Parse5Node;
    if (current.status === STATUS_FRAGMENT) current = current.lastChild;
    else break;
  }
  return null;
}

// =============================================================================
// Serialization
// =============================================================================

/**
 * Serializer function type - accepts unknown for compatibility with render functions
 */
export type Serialize = (element: unknown) => string;

/**
 * Serialize an element to HTML string (including the element itself)
 */
function serializeElement(element: unknown): string {
  const node = element as Parse5Node;
  if (!isElement(node)) {
    // Text or comment nodes need to be wrapped to serialize
    const wrapper = createElement('div');
    appendChild(wrapper, node);
    return serialize(wrapper);
  }
  return serializeOuter(node);
}

// =============================================================================
// Server Adapter
// =============================================================================

/**
 * Result from createParse5Adapter
 */
export type Parse5AdapterResult = {
  /** The adapter for mounting components */
  adapter: Adapter<Parse5TreeConfig>;
  /** Serialize an element to HTML string */
  serialize: Serialize;
  /** Insert fragment markers for a fragment (used by render functions) */
  insertFragmentMarkers: (fragment: FragmentRef<unknown>) => void;
};

/**
 * Create a parse5 adapter for server-side rendering
 *
 * Uses parse5's AST directly for efficient SSR rendering.
 *
 * @example
 * ```typescript
 * import { createParse5Adapter } from '@rimitive/ssr/server';
 *
 * const { adapter, serialize } = createParse5Adapter();
 * // Use adapter for mounting, serialize for renderToString
 * ```
 */
export function createParse5Adapter(): Parse5AdapterResult {
  /**
   * Insert markers for a fragment.
   *
   * parentElement is derived from the AST tree - by the time we call this,
   * the content is already attached so we can get it from firstNode.parentNode.
   */
  const insertFragmentMarkers = (fragment: FragmentRef<unknown>): void => {
    if (!fragment.firstChild || !fragment.lastChild) return;

    const firstNode = getFirstNode(fragment.firstChild);
    const lastNode = getLastNode(fragment.lastChild);

    if (!firstNode || !lastNode) return;

    // Derive parentElement from the AST tree
    const parentElement = firstNode.parentNode as Parse5Element | null;
    if (!parentElement) return;

    // Insert fragment-start comment before first child
    const startComment = createCommentNode('fragment-start');
    insertBefore(parentElement, startComment, firstNode);

    // Insert fragment-end comment after last child
    const nextSibling = getNextSibling(lastNode);
    insertBefore(parentElement, createCommentNode('fragment-end'), nextSibling);
  };

  const adapter: Adapter<Parse5TreeConfig> = {
    createNode: <K extends keyof Parse5TreeConfig['nodes'] & string>(
      type: K,
      props?: Record<string, unknown>,
      parentContext?: ParentContext<unknown>
    ): Parse5TreeConfig['nodes'][K] => {
      if (type === 'text') {
        return createTextNode(props?.value != null ? String(props.value) : '');
      }

      // Determine SVG namespace from parent context
      const parentElement = parentContext?.element as Parse5Element | undefined;
      const parentIsSvg = parentElement?.namespaceURI === NS_SVG;
      const parentIsForeignObject = parentElement?.tagName === 'foreignObject';

      // Use SVG namespace if:
      // 1. Creating an <svg> element (root SVG)
      // 2. Parent is SVG and NOT foreignObject (foreignObject children are HTML)
      const useSvgNs =
        type === 'svg' || (parentIsSvg && !parentIsForeignObject);

      return createElement(type, useSvgNs ? NS_SVG : NS_HTML);
    },

    setAttribute: (node, key, value) => {
      // Handle text nodes
      if (node.nodeName === '#text') {
        if (key === 'value') {
          (node as Parse5TextNode).value = value != null ? String(value) : '';
        }
        return;
      }

      const element = node as Parse5Element;

      // Skip event handlers during SSR
      if (key.startsWith('on')) return;

      // Handle textContent specially - add/replace text child
      if (key === 'textContent') {
        // Clear existing children
        element.childNodes = [];
        // Add text node with the content
        if (value != null) {
          const textNode = createTextNode(String(value));
          appendChild(element, textNode);
        }
        return;
      }

      // Map JSX-style props to HTML attributes
      const attributeName = key === 'className' ? 'class' : key;

      if (value == null || value === false) {
        removeAttribute(element, attributeName);
      } else if (typeof value !== 'object' && typeof value !== 'function') {
        setAttribute(element, attributeName, String(value));
      }
    },

    appendChild: (parent, child) => {
      appendChild(parent as Parse5Element, child as Parse5Node);
    },

    removeChild: (parent, child) => {
      removeChild(parent as Parse5Element, child as Parse5Node);
    },

    insertBefore: (parent, child, reference) => {
      insertBefore(
        parent as Parse5Element,
        child as Parse5Node,
        reference as Parse5Node | null
      );
    },

    /**
     * Lifecycle: onAttach
     *
     * For non-async fragments: adds fragment-start/end comment markers immediately.
     * For async fragments: skips marker insertion (handled by render functions).
     */
    onAttach: (ref) => {
      if (ref.status !== STATUS_FRAGMENT) return;
      if (isAsyncFragment(ref)) return;

      insertFragmentMarkers(ref);
    },

    /**
     * Create a Declarative Shadow DOM template for SSR
     *
     * Instead of attachShadow(), creates a <template shadowrootmode="...">
     * element that browsers will upgrade to a real shadow root on parse.
     */
    createShadowRoot: (host, options) => {
      const hostElement = host as Parse5Element;

      // Create the DSD template
      const template = createDSDTemplate(options.mode, options.delegatesFocus);

      // Append template to host
      appendChild(hostElement, template);

      // Return the template's content as the container for children
      // Children appended here will serialize inside the template
      return {
        container: template.content as Parse5TreeConfig['nodes'][string],
        shadowRoot: null, // No real shadow root in SSR
      };
    },
  };

  return {
    adapter,
    serialize: serializeElement,
    insertFragmentMarkers,
  };
}
