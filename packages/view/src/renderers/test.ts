/**
 * Test/Mock Renderer for unit testing
 *
 * A lightweight in-memory renderer that captures all operations for assertions.
 * No DOM dependency - runs in any JS environment.
 *
 * Features:
 * - Fast execution (no DOM overhead)
 * - Easy tree structure assertions
 * - Operation logging for debugging
 * - Serialization to string for snapshot testing
 */

import type { Renderer, RendererConfig } from '../renderer';

/**
 * A mock node in the test tree
 */
export interface TestNode {
  type: string;
  props: Record<string, unknown>;
  children: TestNode[];
  parent: TestNode | null;
}

/**
 * Renderer config for test renderer
 */
export interface TestRendererConfig extends RendererConfig {
  elements: Record<string, TestNode> & { text: TestNode };
  events: Record<string, Event>;
  baseElement: TestNode;
}

/**
 * Operation types for logging
 */
export type TestRendererOperation =
  | { type: 'createNode'; nodeType: string; props?: Record<string, unknown>; node: TestNode }
  | { type: 'setProperty'; node: TestNode; key: string; value: unknown }
  | { type: 'appendChild'; parent: TestNode; child: TestNode }
  | { type: 'removeChild'; parent: TestNode; child: TestNode }
  | { type: 'insertBefore'; parent: TestNode; child: TestNode; reference: TestNode | null };

/**
 * Test renderer instance with additional utilities
 */
export interface TestRenderer extends Renderer<TestRendererConfig> {
  /** All operations performed, in order */
  operations: TestRendererOperation[];

  /** Clear operation log */
  clearOperations(): void;

  /** Serialize a node tree to a readable string */
  serialize(node: TestNode, indent?: number): string;

  /** Find nodes by type */
  findByType(root: TestNode, type: string): TestNode[];

  /** Find nodes by prop value */
  findByProp(root: TestNode, key: string, value: unknown): TestNode[];

  /** Get text content of a node (concatenates all text children) */
  getTextContent(node: TestNode): string;
}

/**
 * Create a test node
 */
function createTestNode(
  type: string,
  props: Record<string, unknown> = {}
): TestNode {
  return {
    type,
    props: { ...props },
    children: [],
    parent: null,
  };
}

/**
 * Create a test renderer for unit testing
 */
export function createTestRenderer(): TestRenderer {
  const operations: TestRendererOperation[] = [];

  const renderer: TestRenderer = {
    operations,

    createNode: (type, props) => {
      const node = createTestNode(type, props);
      operations.push({ type: 'createNode', nodeType: type, props, node });
      return node;
    },

    setProperty: (node, key, value) => {
      node.props[key] = value;
      operations.push({ type: 'setProperty', node, key, value });
    },

    appendChild: (parent, child) => {
      // Remove from old parent if needed
      if (child.parent) {
        const oldParent = child.parent;
        const idx = oldParent.children.indexOf(child);
        if (idx !== -1) {
          oldParent.children.splice(idx, 1);
        }
      }

      child.parent = parent;
      parent.children.push(child);
      operations.push({ type: 'appendChild', parent, child });
    },

    removeChild: (parent, child) => {
      const idx = parent.children.indexOf(child);
      if (idx !== -1) {
        parent.children.splice(idx, 1);
        child.parent = null;
      }
      operations.push({ type: 'removeChild', parent, child });
    },

    insertBefore: (parent, child, reference) => {
      // Remove from old parent if needed
      if (child.parent) {
        const oldParent = child.parent;
        const idx = oldParent.children.indexOf(child);
        if (idx !== -1) {
          oldParent.children.splice(idx, 1);
        }
      }

      child.parent = parent;

      if (reference === null) {
        parent.children.push(child);
      } else {
        const refIdx = parent.children.indexOf(reference);
        if (refIdx !== -1) {
          parent.children.splice(refIdx, 0, child);
        } else {
          // Reference not found, append
          parent.children.push(child);
        }
      }
      operations.push({ type: 'insertBefore', parent, child, reference });
    },

    clearOperations() {
      operations.length = 0;
    },

    serialize(node, indent = 0) {
      const pad = '  '.repeat(indent);

      if (node.type === 'text') {
        const value = node.props.value;
        return `${pad}"${String(value)}"`;
      }

      const propsStr = Object.entries(node.props)
        .filter(([k]) => k !== 'value')
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ');

      const opening = propsStr ? `<${node.type} ${propsStr}>` : `<${node.type}>`;

      if (node.children.length === 0) {
        return `${pad}${opening}</${node.type}>`;
      }

      const childrenStr = node.children
        .map((c) => renderer.serialize(c, indent + 1))
        .join('\n');

      return `${pad}${opening}\n${childrenStr}\n${pad}</${node.type}>`;
    },

    findByType(root, type) {
      const results: TestNode[] = [];

      function walk(node: TestNode) {
        if (node.type === type) {
          results.push(node);
        }
        for (const child of node.children) {
          walk(child);
        }
      }

      walk(root);
      return results;
    },

    findByProp(root, key, value) {
      const results: TestNode[] = [];

      function walk(node: TestNode) {
        if (node.props[key] === value) {
          results.push(node);
        }
        for (const child of node.children) {
          walk(child);
        }
      }

      walk(root);
      return results;
    },

    getTextContent(node) {
      if (node.type === 'text') {
        return String(node.props.value ?? '');
      }

      return node.children.map((c) => renderer.getTextContent(c)).join('');
    },
  };

  return renderer;
}

/**
 * Create a root node for testing
 * Useful as a container for rendered content
 */
export function createTestRoot(): TestNode {
  return createTestNode('root');
}
