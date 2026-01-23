import { describe, it, expect } from 'vitest';
import { createTestAdapter, createTestRoot, type TestNode } from './test';

describe('test adapter', () => {
  describe('createNode', () => {
    it('creates element nodes', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('div', { className: 'container' });

      expect(node.type).toBe('div');
      expect(node.props.className).toBe('container');
      expect(node.children).toEqual([]);
      expect(node.parent).toBeNull();
    });

    it('creates text nodes', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('text', { value: 'Hello' });

      expect(node.type).toBe('text');
      expect(node.props.value).toBe('Hello');
      expect(node.children).toEqual([]);
      expect(node.parent).toBeNull();
    });

    it('creates nodes without props', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('span');

      expect(node.type).toBe('span');
      expect(node.props).toEqual({});
      expect(node.children).toEqual([]);
      expect(node.parent).toBeNull();
    });

    it('logs createNode operations', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('div', { id: 'test' });

      expect(adapter.operations).toHaveLength(1);
      expect(adapter.operations[0]).toEqual({
        type: 'createNode',
        nodeType: 'div',
        props: { id: 'test' },
        node,
      });
    });
  });

  describe('setAttribute', () => {
    it('sets property on node', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('div');

      adapter.setAttribute(node, 'className', 'active');

      expect(node.props.className).toBe('active');
    });

    it('updates existing property', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('div', { className: 'initial' });

      adapter.setAttribute(node, 'className', 'updated');

      expect(node.props.className).toBe('updated');
    });

    it('handles various value types', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('div');

      adapter.setAttribute(node, 'text', 'string');
      adapter.setAttribute(node, 'count', 42);
      adapter.setAttribute(node, 'active', true);
      adapter.setAttribute(node, 'data', { foo: 'bar' });
      adapter.setAttribute(node, 'empty', null);

      expect(node.props.text).toBe('string');
      expect(node.props.count).toBe(42);
      expect(node.props.active).toBe(true);
      expect(node.props.data).toEqual({ foo: 'bar' });
      expect(node.props.empty).toBeNull();
    });

    it('logs setAttribute operations', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('div');

      adapter.clearOperations();
      adapter.setAttribute(node, 'className', 'test');

      expect(adapter.operations).toHaveLength(1);
      expect(adapter.operations[0]).toEqual({
        type: 'setAttribute',
        node,
        key: 'className',
        value: 'test',
      });
    });
  });

  describe('appendChild', () => {
    it('appends child to parent', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const child = adapter.createNode('span');

      adapter.appendChild(parent, child);

      expect(parent.children).toEqual([child]);
      expect(child.parent).toBe(parent);
    });

    it('appends multiple children in order', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const child1 = adapter.createNode('span');
      const child2 = adapter.createNode('p');
      const child3 = adapter.createNode('text', { value: 'Hello' });

      adapter.appendChild(parent, child1);
      adapter.appendChild(parent, child2);
      adapter.appendChild(parent, child3);

      expect(parent.children).toEqual([child1, child2, child3]);
      expect(child1.parent).toBe(parent);
      expect(child2.parent).toBe(parent);
      expect(child3.parent).toBe(parent);
    });

    it('removes child from old parent when appending to new parent', () => {
      const adapter = createTestAdapter();
      const oldParent = adapter.createNode('div');
      const newParent = adapter.createNode('section');
      const child = adapter.createNode('span');

      adapter.appendChild(oldParent, child);
      expect(oldParent.children).toEqual([child]);

      adapter.appendChild(newParent, child);

      expect(oldParent.children).toEqual([]);
      expect(newParent.children).toEqual([child]);
      expect(child.parent).toBe(newParent);
    });

    it('logs appendChild operations', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const child = adapter.createNode('span');

      adapter.clearOperations();
      adapter.appendChild(parent, child);

      expect(adapter.operations).toHaveLength(1);
      expect(adapter.operations[0]).toEqual({
        type: 'appendChild',
        parent,
        child,
      });
    });
  });

  describe('removeChild', () => {
    it('removes child from parent', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const child = adapter.createNode('span');

      adapter.appendChild(parent, child);
      adapter.removeChild(parent, child);

      expect(parent.children).toEqual([]);
      expect(child.parent).toBeNull();
    });

    it('removes child from middle of children array', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const child1 = adapter.createNode('span');
      const child2 = adapter.createNode('p');
      const child3 = adapter.createNode('a');

      adapter.appendChild(parent, child1);
      adapter.appendChild(parent, child2);
      adapter.appendChild(parent, child3);

      adapter.removeChild(parent, child2);

      expect(parent.children).toEqual([child1, child3]);
      expect(child2.parent).toBeNull();
    });

    it('handles removing non-existent child gracefully', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const child = adapter.createNode('span');

      adapter.removeChild(parent, child);

      expect(parent.children).toEqual([]);
    });

    it('logs removeChild operations', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const child = adapter.createNode('span');

      adapter.appendChild(parent, child);
      adapter.clearOperations();
      adapter.removeChild(parent, child);

      expect(adapter.operations).toHaveLength(1);
      expect(adapter.operations[0]).toEqual({
        type: 'removeChild',
        parent,
        child,
      });
    });
  });

  describe('insertBefore', () => {
    it('inserts child before reference node', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const child1 = adapter.createNode('span');
      const child2 = adapter.createNode('p');
      const newChild = adapter.createNode('a');

      adapter.appendChild(parent, child1);
      adapter.appendChild(parent, child2);

      adapter.insertBefore(parent, newChild, child2);

      expect(parent.children).toEqual([child1, newChild, child2]);
      expect(newChild.parent).toBe(parent);
    });

    it('inserts child at beginning when reference is first child', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const child1 = adapter.createNode('span');
      const newChild = adapter.createNode('a');

      adapter.appendChild(parent, child1);
      adapter.insertBefore(parent, newChild, child1);

      expect(parent.children).toEqual([newChild, child1]);
    });

    it('appends child when reference is null', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const child1 = adapter.createNode('span');
      const child2 = adapter.createNode('p');

      adapter.appendChild(parent, child1);
      adapter.insertBefore(parent, child2, null);

      expect(parent.children).toEqual([child1, child2]);
    });

    it('appends child when reference not found in children', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const child1 = adapter.createNode('span');
      const newChild = adapter.createNode('a');
      const nonExistentRef = adapter.createNode('p');

      adapter.appendChild(parent, child1);
      adapter.insertBefore(parent, newChild, nonExistentRef);

      expect(parent.children).toEqual([child1, newChild]);
    });

    it('removes child from old parent when inserting', () => {
      const adapter = createTestAdapter();
      const oldParent = adapter.createNode('div');
      const newParent = adapter.createNode('section');
      const child = adapter.createNode('span');
      const reference = adapter.createNode('p');

      adapter.appendChild(oldParent, child);
      adapter.appendChild(newParent, reference);

      adapter.insertBefore(newParent, child, reference);

      expect(oldParent.children).toEqual([]);
      expect(newParent.children).toEqual([child, reference]);
      expect(child.parent).toBe(newParent);
    });

    it('logs insertBefore operations', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const child = adapter.createNode('span');
      const reference = adapter.createNode('p');

      adapter.appendChild(parent, reference);
      adapter.clearOperations();
      adapter.insertBefore(parent, child, reference);

      expect(adapter.operations).toHaveLength(1);
      expect(adapter.operations[0]).toEqual({
        type: 'insertBefore',
        parent,
        child,
        reference,
      });
    });
  });

  describe('serialize', () => {
    it('serializes text nodes', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('text', { value: 'Hello' });

      const result = adapter.serialize(node);

      expect(result).toBe('"Hello"');
    });

    it('serializes empty element', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('div');

      const result = adapter.serialize(node);

      expect(result).toBe('<div></div>');
    });

    it('serializes element with props', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('div', {
        className: 'container',
        id: 'main',
      });

      const result = adapter.serialize(node);

      expect(result).toContain('<div');
      expect(result).toContain('className="container"');
      expect(result).toContain('id="main"');
      expect(result).toContain('</div>');
    });

    it('serializes element with children', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const child1 = adapter.createNode('span');
      const child2 = adapter.createNode('text', { value: 'Hello' });

      adapter.appendChild(parent, child1);
      adapter.appendChild(parent, child2);

      const result = adapter.serialize(parent);

      expect(result).toContain('<div>');
      expect(result).toContain('<span></span>');
      expect(result).toContain('"Hello"');
      expect(result).toContain('</div>');
    });

    it('serializes nested elements with indentation', () => {
      const adapter = createTestAdapter();
      const root = adapter.createNode('div');
      const child = adapter.createNode('span');
      const text = adapter.createNode('text', { value: 'Nested' });

      adapter.appendChild(child, text);
      adapter.appendChild(root, child);

      const result = adapter.serialize(root);

      expect(result).toMatch(
        /<div>\n\s+<span>\n\s+"Nested"\n\s+<\/span>\n<\/div>/
      );
    });

    it('excludes value prop from element serialization', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('input', {
        value: 'test',
        type: 'text',
      });

      const result = adapter.serialize(node);

      expect(result).toContain('type="text"');
      expect(result).not.toContain('value=');
    });

    it('handles custom indentation', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('div');
      const child = adapter.createNode('span');
      adapter.appendChild(node, child);

      const result = adapter.serialize(node, 2);

      expect(result).toMatch(/^\s{4}<div>/);
    });
  });

  describe('findByType', () => {
    it('finds nodes by type', () => {
      const adapter = createTestAdapter();
      const root = adapter.createNode('div');
      const span1 = adapter.createNode('span');
      const span2 = adapter.createNode('span');
      const p = adapter.createNode('p');

      adapter.appendChild(root, span1);
      adapter.appendChild(root, span2);
      adapter.appendChild(root, p);

      const results = adapter.findByType(root, 'span');

      expect(results).toHaveLength(2);
      expect(results).toContain(span1);
      expect(results).toContain(span2);
    });

    it('finds nested nodes by type', () => {
      const adapter = createTestAdapter();
      const root = adapter.createNode('div');
      const section = adapter.createNode('section');
      const span = adapter.createNode('span');

      adapter.appendChild(section, span);
      adapter.appendChild(root, section);

      const results = adapter.findByType(root, 'span');

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(span);
    });

    it('returns empty array when type not found', () => {
      const adapter = createTestAdapter();
      const root = adapter.createNode('div');
      const span = adapter.createNode('span');
      adapter.appendChild(root, span);

      const results = adapter.findByType(root, 'p');

      expect(results).toEqual([]);
    });

    it('includes root node if type matches', () => {
      const adapter = createTestAdapter();
      const root = adapter.createNode('div');
      const child = adapter.createNode('div');
      adapter.appendChild(root, child);

      const results = adapter.findByType(root, 'div');

      expect(results).toHaveLength(2);
      expect(results).toContain(root);
      expect(results).toContain(child);
    });

    it('finds text nodes', () => {
      const adapter = createTestAdapter();
      const root = adapter.createNode('div');
      const text1 = adapter.createNode('text', { value: 'Hello' });
      const text2 = adapter.createNode('text', { value: 'World' });

      adapter.appendChild(root, text1);
      adapter.appendChild(root, text2);

      const results = adapter.findByType(root, 'text');

      expect(results).toHaveLength(2);
      expect(results).toContain(text1);
      expect(results).toContain(text2);
    });
  });

  describe('findByProp', () => {
    it('finds nodes by prop value', () => {
      const adapter = createTestAdapter();
      const root = adapter.createNode('div');
      const node1 = adapter.createNode('div', { className: 'active' });
      const node2 = adapter.createNode('span', { className: 'active' });
      const node3 = adapter.createNode('p', { className: 'inactive' });

      adapter.appendChild(root, node1);
      adapter.appendChild(root, node2);
      adapter.appendChild(root, node3);

      const results = adapter.findByProp(root, 'className', 'active');

      expect(results).toHaveLength(2);
      expect(results).toContain(node1);
      expect(results).toContain(node2);
    });

    it('finds nested nodes by prop value', () => {
      const adapter = createTestAdapter();
      const root = adapter.createNode('div');
      const section = adapter.createNode('section');
      const target = adapter.createNode('span', { id: 'target' });

      adapter.appendChild(section, target);
      adapter.appendChild(root, section);

      const results = adapter.findByProp(root, 'id', 'target');

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(target);
    });

    it('returns empty array when prop value not found', () => {
      const adapter = createTestAdapter();
      const root = adapter.createNode('div', { className: 'foo' });

      const results = adapter.findByProp(root, 'className', 'bar');

      expect(results).toEqual([]);
    });

    it('includes root node if prop matches', () => {
      const adapter = createTestAdapter();
      const root = adapter.createNode('div', { className: 'container' });

      const results = adapter.findByProp(root, 'className', 'container');

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(root);
    });

    it('matches different value types', () => {
      const adapter = createTestAdapter();
      const root = adapter.createNode('div');
      const node1 = adapter.createNode('div', { count: 42 });
      const node2 = adapter.createNode('div', { active: true });
      const node3 = adapter.createNode('div', { data: null });

      adapter.appendChild(root, node1);
      adapter.appendChild(root, node2);
      adapter.appendChild(root, node3);

      expect(adapter.findByProp(root, 'count', 42)).toEqual([node1]);
      expect(adapter.findByProp(root, 'active', true)).toEqual([node2]);
      expect(adapter.findByProp(root, 'data', null)).toEqual([node3]);
    });
  });

  describe('getTextContent', () => {
    it('returns text node value', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('text', { value: 'Hello' });

      const result = adapter.getTextContent(node);

      expect(result).toBe('Hello');
    });

    it('returns empty string for text node without value', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('text', {});

      const result = adapter.getTextContent(node);

      expect(result).toBe('');
    });

    it('concatenates text from children', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const text1 = adapter.createNode('text', { value: 'Hello' });
      const text2 = adapter.createNode('text', { value: ' ' });
      const text3 = adapter.createNode('text', { value: 'World' });

      adapter.appendChild(parent, text1);
      adapter.appendChild(parent, text2);
      adapter.appendChild(parent, text3);

      const result = adapter.getTextContent(parent);

      expect(result).toBe('Hello World');
    });

    it('concatenates nested text content', () => {
      const adapter = createTestAdapter();
      const root = adapter.createNode('div');
      const section = adapter.createNode('section');
      const span = adapter.createNode('span');
      const text1 = adapter.createNode('text', { value: 'Nested' });
      const text2 = adapter.createNode('text', { value: ' Text' });

      adapter.appendChild(span, text1);
      adapter.appendChild(section, span);
      adapter.appendChild(section, text2);
      adapter.appendChild(root, section);

      const result = adapter.getTextContent(root);

      expect(result).toBe('Nested Text');
    });

    it('returns empty string for element without text children', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('div');

      const result = adapter.getTextContent(node);

      expect(result).toBe('');
    });

    it('handles numeric values in text nodes', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('text', { value: 42 });

      const result = adapter.getTextContent(node);

      expect(result).toBe('42');
    });
  });

  describe('clearOperations', () => {
    it('clears operation log', () => {
      const adapter = createTestAdapter();

      adapter.createNode('div');
      adapter.createNode('span');

      expect(adapter.operations.length).toBeGreaterThan(0);

      adapter.clearOperations();

      expect(adapter.operations).toEqual([]);
    });

    it('allows logging new operations after clearing', () => {
      const adapter = createTestAdapter();

      adapter.createNode('div');
      adapter.clearOperations();

      adapter.createNode('span');

      expect(adapter.operations).toHaveLength(1);
      expect(adapter.operations[0]?.type).toBe('createNode');
      expect((adapter.operations[0] as { nodeType: string }).nodeType).toBe(
        'span'
      );
    });
  });

  describe('operations logging', () => {
    it('logs operations in order', () => {
      const adapter = createTestAdapter();
      const parent = adapter.createNode('div');
      const child = adapter.createNode('span');

      adapter.clearOperations();

      adapter.setAttribute(parent, 'className', 'container');
      adapter.appendChild(parent, child);
      adapter.setAttribute(child, 'textContent', 'Hello');
      adapter.removeChild(parent, child);

      expect(adapter.operations).toHaveLength(4);
      expect(adapter.operations[0]?.type).toBe('setAttribute');
      expect(adapter.operations[1]?.type).toBe('appendChild');
      expect(adapter.operations[2]?.type).toBe('setAttribute');
      expect(adapter.operations[3]?.type).toBe('removeChild');
    });

    it('preserves operation references', () => {
      const adapter = createTestAdapter();
      const node = adapter.createNode('div');

      adapter.clearOperations();
      adapter.setAttribute(node, 'id', 'test');

      const operation = adapter.operations[0];
      expect(operation?.type).toBe('setAttribute');
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
      const adapter = createTestAdapter();
      const root = createTestRoot();
      const child = adapter.createNode('div', { className: 'app' });

      adapter.appendChild(root, child);

      expect(root.children).toEqual([child]);
      expect(child.parent).toBe(root);
    });
  });

  describe('integration scenarios', () => {
    it('builds complex tree structure', () => {
      const adapter = createTestAdapter();
      const root = createTestRoot();

      const header = adapter.createNode('header');
      const h1 = adapter.createNode('h1');
      const title = adapter.createNode('text', { value: 'Title' });

      const main = adapter.createNode('main');
      const p = adapter.createNode('p');
      const text = adapter.createNode('text', { value: 'Content' });

      adapter.appendChild(h1, title);
      adapter.appendChild(header, h1);
      adapter.appendChild(p, text);
      adapter.appendChild(main, p);
      adapter.appendChild(root, header);
      adapter.appendChild(root, main);

      expect(root.children).toHaveLength(2);
      expect(adapter.getTextContent(root)).toBe('TitleContent');

      const headers = adapter.findByType(root, 'header');
      expect(headers).toHaveLength(1);

      const paragraphs = adapter.findByType(root, 'p');
      expect(paragraphs).toHaveLength(1);
    });

    it('handles dynamic updates', () => {
      const adapter = createTestAdapter();
      const root = createTestRoot();
      const container = adapter.createNode('div');
      const text = adapter.createNode('text', { value: 'Initial' });

      adapter.appendChild(container, text);
      adapter.appendChild(root, container);

      expect(adapter.getTextContent(root)).toBe('Initial');

      adapter.setAttribute(text, 'value', 'Updated');

      expect(adapter.getTextContent(root)).toBe('Updated');
    });

    it('supports tree restructuring', () => {
      const adapter = createTestAdapter();
      const root = createTestRoot();
      const section1 = adapter.createNode('section', { id: 'section1' });
      const section2 = adapter.createNode('section', { id: 'section2' });
      const item = adapter.createNode('div', { className: 'item' });

      adapter.appendChild(section1, item);
      adapter.appendChild(root, section1);
      adapter.appendChild(root, section2);

      expect(section1.children).toEqual([item]);
      expect(section2.children).toEqual([]);

      adapter.removeChild(section1, item);
      adapter.appendChild(section2, item);

      expect(section1.children).toEqual([]);
      expect(section2.children).toEqual([item]);
      expect(item.parent).toBe(section2);
    });
  });
});
