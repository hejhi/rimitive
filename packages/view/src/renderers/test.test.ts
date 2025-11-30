import { describe, it, expect } from 'vitest';
import {
  createTestRenderer,
  createTestRoot,
  type TestNode,
} from './test';

describe('test renderer', () => {
  describe('createNode', () => {
    it('creates element nodes', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('div', { className: 'container' });

      expect(node.type).toBe('div');
      expect(node.props.className).toBe('container');
      expect(node.children).toEqual([]);
      expect(node.parent).toBeNull();
    });

    it('creates text nodes', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('text', { value: 'Hello' });

      expect(node.type).toBe('text');
      expect(node.props.value).toBe('Hello');
      expect(node.children).toEqual([]);
      expect(node.parent).toBeNull();
    });

    it('creates nodes without props', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('span');

      expect(node.type).toBe('span');
      expect(node.props).toEqual({});
      expect(node.children).toEqual([]);
      expect(node.parent).toBeNull();
    });

    it('logs createNode operations', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('div', { id: 'test' });

      expect(renderer.operations).toHaveLength(1);
      expect(renderer.operations[0]).toEqual({
        type: 'createNode',
        nodeType: 'div',
        props: { id: 'test' },
        node,
      });
    });
  });

  describe('setProperty', () => {
    it('sets property on node', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('div');

      renderer.setProperty(node, 'className', 'active');

      expect(node.props.className).toBe('active');
    });

    it('updates existing property', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('div', { className: 'initial' });

      renderer.setProperty(node, 'className', 'updated');

      expect(node.props.className).toBe('updated');
    });

    it('handles various value types', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('div');

      renderer.setProperty(node, 'text', 'string');
      renderer.setProperty(node, 'count', 42);
      renderer.setProperty(node, 'active', true);
      renderer.setProperty(node, 'data', { foo: 'bar' });
      renderer.setProperty(node, 'empty', null);

      expect(node.props.text).toBe('string');
      expect(node.props.count).toBe(42);
      expect(node.props.active).toBe(true);
      expect(node.props.data).toEqual({ foo: 'bar' });
      expect(node.props.empty).toBeNull();
    });

    it('logs setProperty operations', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('div');

      renderer.clearOperations();
      renderer.setProperty(node, 'className', 'test');

      expect(renderer.operations).toHaveLength(1);
      expect(renderer.operations[0]).toEqual({
        type: 'setProperty',
        node,
        key: 'className',
        value: 'test',
      });
    });
  });

  describe('appendChild', () => {
    it('appends child to parent', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const child = renderer.createNode('span');

      renderer.appendChild(parent, child);

      expect(parent.children).toEqual([child]);
      expect(child.parent).toBe(parent);
    });

    it('appends multiple children in order', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const child1 = renderer.createNode('span');
      const child2 = renderer.createNode('p');
      const child3 = renderer.createNode('text', { value: 'Hello' });

      renderer.appendChild(parent, child1);
      renderer.appendChild(parent, child2);
      renderer.appendChild(parent, child3);

      expect(parent.children).toEqual([child1, child2, child3]);
      expect(child1.parent).toBe(parent);
      expect(child2.parent).toBe(parent);
      expect(child3.parent).toBe(parent);
    });

    it('removes child from old parent when appending to new parent', () => {
      const renderer = createTestRenderer();
      const oldParent = renderer.createNode('div');
      const newParent = renderer.createNode('section');
      const child = renderer.createNode('span');

      renderer.appendChild(oldParent, child);
      expect(oldParent.children).toEqual([child]);

      renderer.appendChild(newParent, child);

      expect(oldParent.children).toEqual([]);
      expect(newParent.children).toEqual([child]);
      expect(child.parent).toBe(newParent);
    });

    it('logs appendChild operations', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const child = renderer.createNode('span');

      renderer.clearOperations();
      renderer.appendChild(parent, child);

      expect(renderer.operations).toHaveLength(1);
      expect(renderer.operations[0]).toEqual({
        type: 'appendChild',
        parent,
        child,
      });
    });
  });

  describe('removeChild', () => {
    it('removes child from parent', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const child = renderer.createNode('span');

      renderer.appendChild(parent, child);
      renderer.removeChild(parent, child);

      expect(parent.children).toEqual([]);
      expect(child.parent).toBeNull();
    });

    it('removes child from middle of children array', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const child1 = renderer.createNode('span');
      const child2 = renderer.createNode('p');
      const child3 = renderer.createNode('a');

      renderer.appendChild(parent, child1);
      renderer.appendChild(parent, child2);
      renderer.appendChild(parent, child3);

      renderer.removeChild(parent, child2);

      expect(parent.children).toEqual([child1, child3]);
      expect(child2.parent).toBeNull();
    });

    it('handles removing non-existent child gracefully', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const child = renderer.createNode('span');

      renderer.removeChild(parent, child);

      expect(parent.children).toEqual([]);
    });

    it('logs removeChild operations', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const child = renderer.createNode('span');

      renderer.appendChild(parent, child);
      renderer.clearOperations();
      renderer.removeChild(parent, child);

      expect(renderer.operations).toHaveLength(1);
      expect(renderer.operations[0]).toEqual({
        type: 'removeChild',
        parent,
        child,
      });
    });
  });

  describe('insertBefore', () => {
    it('inserts child before reference node', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const child1 = renderer.createNode('span');
      const child2 = renderer.createNode('p');
      const newChild = renderer.createNode('a');

      renderer.appendChild(parent, child1);
      renderer.appendChild(parent, child2);

      renderer.insertBefore(parent, newChild, child2);

      expect(parent.children).toEqual([child1, newChild, child2]);
      expect(newChild.parent).toBe(parent);
    });

    it('inserts child at beginning when reference is first child', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const child1 = renderer.createNode('span');
      const newChild = renderer.createNode('a');

      renderer.appendChild(parent, child1);
      renderer.insertBefore(parent, newChild, child1);

      expect(parent.children).toEqual([newChild, child1]);
    });

    it('appends child when reference is null', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const child1 = renderer.createNode('span');
      const child2 = renderer.createNode('p');

      renderer.appendChild(parent, child1);
      renderer.insertBefore(parent, child2, null);

      expect(parent.children).toEqual([child1, child2]);
    });

    it('appends child when reference not found in children', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const child1 = renderer.createNode('span');
      const newChild = renderer.createNode('a');
      const nonExistentRef = renderer.createNode('p');

      renderer.appendChild(parent, child1);
      renderer.insertBefore(parent, newChild, nonExistentRef);

      expect(parent.children).toEqual([child1, newChild]);
    });

    it('removes child from old parent when inserting', () => {
      const renderer = createTestRenderer();
      const oldParent = renderer.createNode('div');
      const newParent = renderer.createNode('section');
      const child = renderer.createNode('span');
      const reference = renderer.createNode('p');

      renderer.appendChild(oldParent, child);
      renderer.appendChild(newParent, reference);

      renderer.insertBefore(newParent, child, reference);

      expect(oldParent.children).toEqual([]);
      expect(newParent.children).toEqual([child, reference]);
      expect(child.parent).toBe(newParent);
    });

    it('logs insertBefore operations', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const child = renderer.createNode('span');
      const reference = renderer.createNode('p');

      renderer.appendChild(parent, reference);
      renderer.clearOperations();
      renderer.insertBefore(parent, child, reference);

      expect(renderer.operations).toHaveLength(1);
      expect(renderer.operations[0]).toEqual({
        type: 'insertBefore',
        parent,
        child,
        reference,
      });
    });
  });

  describe('serialize', () => {
    it('serializes text nodes', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('text', { value: 'Hello' });

      const result = renderer.serialize(node);

      expect(result).toBe('"Hello"');
    });

    it('serializes empty element', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('div');

      const result = renderer.serialize(node);

      expect(result).toBe('<div></div>');
    });

    it('serializes element with props', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('div', {
        className: 'container',
        id: 'main',
      });

      const result = renderer.serialize(node);

      expect(result).toContain('<div');
      expect(result).toContain('className="container"');
      expect(result).toContain('id="main"');
      expect(result).toContain('</div>');
    });

    it('serializes element with children', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const child1 = renderer.createNode('span');
      const child2 = renderer.createNode('text', { value: 'Hello' });

      renderer.appendChild(parent, child1);
      renderer.appendChild(parent, child2);

      const result = renderer.serialize(parent);

      expect(result).toContain('<div>');
      expect(result).toContain('<span></span>');
      expect(result).toContain('"Hello"');
      expect(result).toContain('</div>');
    });

    it('serializes nested elements with indentation', () => {
      const renderer = createTestRenderer();
      const root = renderer.createNode('div');
      const child = renderer.createNode('span');
      const text = renderer.createNode('text', { value: 'Nested' });

      renderer.appendChild(child, text);
      renderer.appendChild(root, child);

      const result = renderer.serialize(root);

      expect(result).toMatch(/<div>\n\s+<span>\n\s+"Nested"\n\s+<\/span>\n<\/div>/);
    });

    it('excludes value prop from element serialization', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('input', {
        value: 'test',
        type: 'text',
      });

      const result = renderer.serialize(node);

      expect(result).toContain('type="text"');
      expect(result).not.toContain('value=');
    });

    it('handles custom indentation', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('div');
      const child = renderer.createNode('span');
      renderer.appendChild(node, child);

      const result = renderer.serialize(node, 2);

      expect(result).toMatch(/^\s{4}<div>/);
    });
  });

  describe('findByType', () => {
    it('finds nodes by type', () => {
      const renderer = createTestRenderer();
      const root = renderer.createNode('div');
      const span1 = renderer.createNode('span');
      const span2 = renderer.createNode('span');
      const p = renderer.createNode('p');

      renderer.appendChild(root, span1);
      renderer.appendChild(root, span2);
      renderer.appendChild(root, p);

      const results = renderer.findByType(root, 'span');

      expect(results).toHaveLength(2);
      expect(results).toContain(span1);
      expect(results).toContain(span2);
    });

    it('finds nested nodes by type', () => {
      const renderer = createTestRenderer();
      const root = renderer.createNode('div');
      const section = renderer.createNode('section');
      const span = renderer.createNode('span');

      renderer.appendChild(section, span);
      renderer.appendChild(root, section);

      const results = renderer.findByType(root, 'span');

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(span);
    });

    it('returns empty array when type not found', () => {
      const renderer = createTestRenderer();
      const root = renderer.createNode('div');
      const span = renderer.createNode('span');
      renderer.appendChild(root, span);

      const results = renderer.findByType(root, 'p');

      expect(results).toEqual([]);
    });

    it('includes root node if type matches', () => {
      const renderer = createTestRenderer();
      const root = renderer.createNode('div');
      const child = renderer.createNode('div');
      renderer.appendChild(root, child);

      const results = renderer.findByType(root, 'div');

      expect(results).toHaveLength(2);
      expect(results).toContain(root);
      expect(results).toContain(child);
    });

    it('finds text nodes', () => {
      const renderer = createTestRenderer();
      const root = renderer.createNode('div');
      const text1 = renderer.createNode('text', { value: 'Hello' });
      const text2 = renderer.createNode('text', { value: 'World' });

      renderer.appendChild(root, text1);
      renderer.appendChild(root, text2);

      const results = renderer.findByType(root, 'text');

      expect(results).toHaveLength(2);
      expect(results).toContain(text1);
      expect(results).toContain(text2);
    });
  });

  describe('findByProp', () => {
    it('finds nodes by prop value', () => {
      const renderer = createTestRenderer();
      const root = renderer.createNode('div');
      const node1 = renderer.createNode('div', { className: 'active' });
      const node2 = renderer.createNode('span', { className: 'active' });
      const node3 = renderer.createNode('p', { className: 'inactive' });

      renderer.appendChild(root, node1);
      renderer.appendChild(root, node2);
      renderer.appendChild(root, node3);

      const results = renderer.findByProp(root, 'className', 'active');

      expect(results).toHaveLength(2);
      expect(results).toContain(node1);
      expect(results).toContain(node2);
    });

    it('finds nested nodes by prop value', () => {
      const renderer = createTestRenderer();
      const root = renderer.createNode('div');
      const section = renderer.createNode('section');
      const target = renderer.createNode('span', { id: 'target' });

      renderer.appendChild(section, target);
      renderer.appendChild(root, section);

      const results = renderer.findByProp(root, 'id', 'target');

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(target);
    });

    it('returns empty array when prop value not found', () => {
      const renderer = createTestRenderer();
      const root = renderer.createNode('div', { className: 'foo' });

      const results = renderer.findByProp(root, 'className', 'bar');

      expect(results).toEqual([]);
    });

    it('includes root node if prop matches', () => {
      const renderer = createTestRenderer();
      const root = renderer.createNode('div', { className: 'container' });

      const results = renderer.findByProp(root, 'className', 'container');

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(root);
    });

    it('matches different value types', () => {
      const renderer = createTestRenderer();
      const root = renderer.createNode('div');
      const node1 = renderer.createNode('div', { count: 42 });
      const node2 = renderer.createNode('div', { active: true });
      const node3 = renderer.createNode('div', { data: null });

      renderer.appendChild(root, node1);
      renderer.appendChild(root, node2);
      renderer.appendChild(root, node3);

      expect(renderer.findByProp(root, 'count', 42)).toEqual([node1]);
      expect(renderer.findByProp(root, 'active', true)).toEqual([node2]);
      expect(renderer.findByProp(root, 'data', null)).toEqual([node3]);
    });
  });

  describe('getTextContent', () => {
    it('returns text node value', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('text', { value: 'Hello' });

      const result = renderer.getTextContent(node);

      expect(result).toBe('Hello');
    });

    it('returns empty string for text node without value', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('text', {});

      const result = renderer.getTextContent(node);

      expect(result).toBe('');
    });

    it('concatenates text from children', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const text1 = renderer.createNode('text', { value: 'Hello' });
      const text2 = renderer.createNode('text', { value: ' ' });
      const text3 = renderer.createNode('text', { value: 'World' });

      renderer.appendChild(parent, text1);
      renderer.appendChild(parent, text2);
      renderer.appendChild(parent, text3);

      const result = renderer.getTextContent(parent);

      expect(result).toBe('Hello World');
    });

    it('concatenates nested text content', () => {
      const renderer = createTestRenderer();
      const root = renderer.createNode('div');
      const section = renderer.createNode('section');
      const span = renderer.createNode('span');
      const text1 = renderer.createNode('text', { value: 'Nested' });
      const text2 = renderer.createNode('text', { value: ' Text' });

      renderer.appendChild(span, text1);
      renderer.appendChild(section, span);
      renderer.appendChild(section, text2);
      renderer.appendChild(root, section);

      const result = renderer.getTextContent(root);

      expect(result).toBe('Nested Text');
    });

    it('returns empty string for element without text children', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('div');

      const result = renderer.getTextContent(node);

      expect(result).toBe('');
    });

    it('handles numeric values in text nodes', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('text', { value: 42 });

      const result = renderer.getTextContent(node);

      expect(result).toBe('42');
    });
  });

  describe('clearOperations', () => {
    it('clears operation log', () => {
      const renderer = createTestRenderer();

      renderer.createNode('div');
      renderer.createNode('span');

      expect(renderer.operations.length).toBeGreaterThan(0);

      renderer.clearOperations();

      expect(renderer.operations).toEqual([]);
    });

    it('allows logging new operations after clearing', () => {
      const renderer = createTestRenderer();

      renderer.createNode('div');
      renderer.clearOperations();

      renderer.createNode('span');

      expect(renderer.operations).toHaveLength(1);
      expect(renderer.operations[0]?.type).toBe('createNode');
      expect((renderer.operations[0] as { nodeType: string }).nodeType).toBe('span');
    });
  });

  describe('operations logging', () => {
    it('logs operations in order', () => {
      const renderer = createTestRenderer();
      const parent = renderer.createNode('div');
      const child = renderer.createNode('span');

      renderer.clearOperations();

      renderer.setProperty(parent, 'className', 'container');
      renderer.appendChild(parent, child);
      renderer.setProperty(child, 'textContent', 'Hello');
      renderer.removeChild(parent, child);

      expect(renderer.operations).toHaveLength(4);
      expect(renderer.operations[0]?.type).toBe('setProperty');
      expect(renderer.operations[1]?.type).toBe('appendChild');
      expect(renderer.operations[2]?.type).toBe('setProperty');
      expect(renderer.operations[3]?.type).toBe('removeChild');
    });

    it('preserves operation references', () => {
      const renderer = createTestRenderer();
      const node = renderer.createNode('div');

      renderer.clearOperations();
      renderer.setProperty(node, 'id', 'test');

      const operation = renderer.operations[0];
      expect(operation?.type).toBe('setProperty');
      expect((operation as { node: TestNode }).node).toBe(node);
    });
  });

  describe('createTestRoot', () => {
    it('creates root node for testing', () => {
      const root = createTestRoot();

      expect(root.type).toBe('root');
      expect(root.props).toEqual({});
      expect(root.children).toEqual([]);
      expect(root.parent).toBeNull();
    });

    it('can be used as container for rendered content', () => {
      const renderer = createTestRenderer();
      const root = createTestRoot();
      const child = renderer.createNode('div', { className: 'app' });

      renderer.appendChild(root, child);

      expect(root.children).toEqual([child]);
      expect(child.parent).toBe(root);
    });
  });

  describe('integration scenarios', () => {
    it('builds complex tree structure', () => {
      const renderer = createTestRenderer();
      const root = createTestRoot();

      const header = renderer.createNode('header');
      const h1 = renderer.createNode('h1');
      const title = renderer.createNode('text', { value: 'Title' });

      const main = renderer.createNode('main');
      const p = renderer.createNode('p');
      const text = renderer.createNode('text', { value: 'Content' });

      renderer.appendChild(h1, title);
      renderer.appendChild(header, h1);
      renderer.appendChild(p, text);
      renderer.appendChild(main, p);
      renderer.appendChild(root, header);
      renderer.appendChild(root, main);

      expect(root.children).toHaveLength(2);
      expect(renderer.getTextContent(root)).toBe('TitleContent');

      const headers = renderer.findByType(root, 'header');
      expect(headers).toHaveLength(1);

      const paragraphs = renderer.findByType(root, 'p');
      expect(paragraphs).toHaveLength(1);
    });

    it('handles dynamic updates', () => {
      const renderer = createTestRenderer();
      const root = createTestRoot();
      const container = renderer.createNode('div');
      const text = renderer.createNode('text', { value: 'Initial' });

      renderer.appendChild(container, text);
      renderer.appendChild(root, container);

      expect(renderer.getTextContent(root)).toBe('Initial');

      renderer.setProperty(text, 'value', 'Updated');

      expect(renderer.getTextContent(root)).toBe('Updated');
    });

    it('supports tree restructuring', () => {
      const renderer = createTestRenderer();
      const root = createTestRoot();
      const section1 = renderer.createNode('section', { id: 'section1' });
      const section2 = renderer.createNode('section', { id: 'section2' });
      const item = renderer.createNode('div', { className: 'item' });

      renderer.appendChild(section1, item);
      renderer.appendChild(root, section1);
      renderer.appendChild(root, section2);

      expect(section1.children).toEqual([item]);
      expect(section2.children).toEqual([]);

      renderer.removeChild(section1, item);
      renderer.appendChild(section2, item);

      expect(section1.children).toEqual([]);
      expect(section2.children).toEqual([item]);
      expect(item.parent).toBe(section2);
    });
  });
});
