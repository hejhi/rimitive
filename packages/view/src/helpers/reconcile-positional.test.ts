/**
 * Tests for positional reconciliation behavior
 *
 * These tests verify what users care about:
 * - Are DOM elements reused when data changes?
 * - Does content update correctly?
 * - Are elements created/destroyed appropriately?
 */

import { describe, it, expect } from 'vitest';
import { reconcilePositional, type ReconcileState } from './reconcile';
import { createTestEnv, MockElement, createRefSpec, getTextContent } from '../test-utils';

describe('reconcilePositional', () => {
  it('should recreate elements when content changes at same index', () => {
    const { ctx, renderer, disposeScope } = createTestEnv();

    const parent = renderer.createElement('ul');
    const state: ReconcileState<MockElement> & { itemsByIndex: any[] } = {
      itemsByKey: new Map(),
      parentElement: parent,
      itemsByIndex: [],
    };

    // Initial render: ['a', 'b', 'c']
    const initialRefSpecs = ['a', 'b', 'c'].map(text => {
      const li = renderer.createElement('li');
      const textNode = renderer.createTextNode(text);
      renderer.appendChild(li, textNode);
      return createRefSpec(li);
    });

    reconcilePositional(initialRefSpecs, state, ctx, renderer, disposeScope);

    expect(parent.children.length).toBe(3);
    expect(getTextContent(parent.children[0] as MockElement)).toBe('a');
    expect(getTextContent(parent.children[1] as MockElement)).toBe('b');
    expect(getTextContent(parent.children[2] as MockElement)).toBe('c');

    // Store references to original elements
    const firstEl = parent.children[0];
    const secondEl = parent.children[1];
    const thirdEl = parent.children[2];

    // Update: ['x', 'b', 'z'] - change first and last
    const updatedRefSpecs = ['x', 'b', 'z'].map(text => {
      const li = renderer.createElement('li');
      const textNode = renderer.createTextNode(text);
      renderer.appendChild(li, textNode);
      return createRefSpec(li);
    });

    reconcilePositional(updatedRefSpecs, state, ctx, renderer, disposeScope);

    // User cares:
    // - Content updates correctly
    // - List length correct
    // Note: Without per-item signals, elements are recreated (not reused)
    // This will be optimized when we add per-item reactivity (task #2)
    expect(parent.children.length).toBe(3);
    expect(getTextContent(parent.children[0] as MockElement)).toBe('x');
    expect(getTextContent(parent.children[1] as MockElement)).toBe('b');
    expect(getTextContent(parent.children[2] as MockElement)).toBe('z');

    // Elements are recreated (new references)
    expect(parent.children[0]).not.toBe(firstEl);
    expect(parent.children[1]).not.toBe(secondEl);
    expect(parent.children[2]).not.toBe(thirdEl);
  });

  it('should handle list growth correctly', () => {
    const { ctx, renderer, disposeScope } = createTestEnv();

    const parent = renderer.createElement('ul');
    const state: ReconcileState<MockElement> & { itemsByIndex: any[] } = {
      itemsByKey: new Map(),
      parentElement: parent,
      itemsByIndex: [],
    };

    // Initial: ['a', 'b']
    const initialRefSpecs = ['a', 'b'].map(text => {
      const li = renderer.createElement('li');
      const textNode = renderer.createTextNode(text);
      renderer.appendChild(li, textNode);
      return createRefSpec(li);
    });

    reconcilePositional(initialRefSpecs, state, ctx, renderer, disposeScope);

    expect(parent.children.length).toBe(2);

    // Grow: ['a', 'b', 'c', 'd']
    // Note: In real usage, render creates fresh RefSpecs with new elements
    const grownRefSpecs = ['a', 'b', 'c', 'd'].map(text => {
      const li = renderer.createElement('li');
      const textNode = renderer.createTextNode(text);
      renderer.appendChild(li, textNode);
      return createRefSpec(li);
    });

    reconcilePositional(grownRefSpecs, state, ctx, renderer, disposeScope);

    // User cares:
    // - List has correct length
    // - All content is correct
    // Note: Without per-item signals, all elements are recreated
    expect(parent.children.length).toBe(4);
    expect(getTextContent(parent.children[0] as MockElement)).toBe('a');
    expect(getTextContent(parent.children[1] as MockElement)).toBe('b');
    expect(getTextContent(parent.children[2] as MockElement)).toBe('c');
    expect(getTextContent(parent.children[3] as MockElement)).toBe('d');
  });

  it('should handle list shrinking correctly', () => {
    const { ctx, renderer, disposeScope } = createTestEnv();

    const parent = renderer.createElement('ul');
    const state: ReconcileState<MockElement> & { itemsByIndex: any[] } = {
      itemsByKey: new Map(),
      parentElement: parent,
      itemsByIndex: [],
    };

    // Initial: ['a', 'b', 'c', 'd']
    const initialRefSpecs = ['a', 'b', 'c', 'd'].map(text => {
      const li = renderer.createElement('li');
      const textNode = renderer.createTextNode(text);
      renderer.appendChild(li, textNode);
      return createRefSpec(li);
    });

    reconcilePositional(initialRefSpecs, state, ctx, renderer, disposeScope);

    expect(parent.children.length).toBe(4);

    // Shrink: ['a', 'b']
    const shrunkRefSpecs = ['a', 'b'].map(text => {
      const li = renderer.createElement('li');
      const textNode = renderer.createTextNode(text);
      renderer.appendChild(li, textNode);
      return createRefSpec(li);
    });

    reconcilePositional(shrunkRefSpecs, state, ctx, renderer, disposeScope);

    // User cares:
    // - List has correct length
    // - Content is correct
    // - Extra elements removed
    expect(parent.children.length).toBe(2);
    expect(getTextContent(parent.children[0] as MockElement)).toBe('a');
    expect(getTextContent(parent.children[1] as MockElement)).toBe('b');
  });

  it('should handle complete replacement correctly', () => {
    const { ctx, renderer, disposeScope } = createTestEnv();

    const parent = renderer.createElement('ul');
    const state: ReconcileState<MockElement> & { itemsByIndex: any[] } = {
      itemsByKey: new Map(),
      parentElement: parent,
      itemsByIndex: [],
    };

    // Initial: ['a', 'b', 'c']
    const initialRefSpecs = ['a', 'b', 'c'].map(text => {
      const li = renderer.createElement('li');
      const textNode = renderer.createTextNode(text);
      renderer.appendChild(li, textNode);
      return createRefSpec(li);
    });

    reconcilePositional(initialRefSpecs, state, ctx, renderer, disposeScope);

    const firstEl = parent.children[0];
    const secondEl = parent.children[1];
    const thirdEl = parent.children[2];

    // Replace: ['x', 'y', 'z']
    const replacedRefSpecs = ['x', 'y', 'z'].map(text => {
      const li = renderer.createElement('li');
      const textNode = renderer.createTextNode(text);
      renderer.appendChild(li, textNode);
      return createRefSpec(li);
    });

    reconcilePositional(replacedRefSpecs, state, ctx, renderer, disposeScope);

    // User cares: Content updated correctly
    expect(parent.children.length).toBe(3);
    expect(getTextContent(parent.children[0] as MockElement)).toBe('x');
    expect(getTextContent(parent.children[1] as MockElement)).toBe('y');
    expect(getTextContent(parent.children[2] as MockElement)).toBe('z');

    // Elements are recreated (will be optimized with per-item signals)
    expect(parent.children[0]).not.toBe(firstEl);
    expect(parent.children[1]).not.toBe(secondEl);
    expect(parent.children[2]).not.toBe(thirdEl);
  });

  it('should handle empty to populated transition', () => {
    const { ctx, renderer, disposeScope } = createTestEnv();

    const parent = renderer.createElement('ul');
    const state: ReconcileState<MockElement> & { itemsByIndex: any[] } = {
      itemsByKey: new Map(),
      parentElement: parent,
      itemsByIndex: [],
    };

    // Start empty
    reconcilePositional([], state, ctx, renderer, disposeScope);
    expect(parent.children.length).toBe(0);

    // Add items
    const newRefSpecs = ['a', 'b'].map(text => {
      const li = renderer.createElement('li');
      const textNode = renderer.createTextNode(text);
      renderer.appendChild(li, textNode);
      return createRefSpec(li);
    });

    reconcilePositional(newRefSpecs, state, ctx, renderer, disposeScope);

    expect(parent.children.length).toBe(2);
    expect(getTextContent(parent.children[0] as MockElement)).toBe('a');
    expect(getTextContent(parent.children[1] as MockElement)).toBe('b');
  });

  it('should handle populated to empty transition', () => {
    const { ctx, renderer, disposeScope } = createTestEnv();

    const parent = renderer.createElement('ul');
    const state: ReconcileState<MockElement> & { itemsByIndex: any[] } = {
      itemsByKey: new Map(),
      parentElement: parent,
      itemsByIndex: [],
    };

    // Start with items
    const initialRefSpecs = ['a', 'b'].map(text => {
      const li = renderer.createElement('li');
      const textNode = renderer.createTextNode(text);
      renderer.appendChild(li, textNode);
      return createRefSpec(li);
    });

    reconcilePositional(initialRefSpecs, state, ctx, renderer, disposeScope);
    expect(parent.children.length).toBe(2);

    // Clear all
    reconcilePositional([], state, ctx, renderer, disposeScope);

    expect(parent.children.length).toBe(0);
    expect(state.itemsByIndex.length).toBe(0);
  });
});
