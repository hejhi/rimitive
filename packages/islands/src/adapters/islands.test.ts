/**
 * Tests for hydrating adapter
 *
 * These tests verify the mode-switching behavior of the adapter.
 * The adapter starts by delegating to the hydrating adapter
 * and switches to the fallback adapter after hydration.
 */

import { describe, it, expect } from 'vitest';
import { createIslandsAdapter } from './islands';
import { createDOMHydrationAdapter } from './dom-hydration';
import { createDOMAdapter } from '@lattice/view/adapters/dom';

describe('createHydratingAdapter', () => {
  it('should expose switchToFallback method', () => {
    const container = document.createElement('div');
    const adapter = createIslandsAdapter(
      createDOMHydrationAdapter(container),
      createDOMAdapter()
    );

    expect(typeof adapter.switchToFallback).toBe('function');
  });

  it('should create elements after switching to fallback', () => {
    const container = document.createElement('div');
    const adapter = createIslandsAdapter(
      createDOMHydrationAdapter(container),
      createDOMAdapter()
    );

    // Switch to fallback immediately (skipping hydration)
    adapter.switchToFallback();

    // Should now create a new element
    const newDiv = adapter.createNode('div') as HTMLElement;
    expect(newDiv).toBeInstanceOf(HTMLElement);
    expect(newDiv.tagName.toLowerCase()).toBe('div');
  });

  it('should create text nodes after switching to fallback', () => {
    const container = document.createElement('div');
    const adapter = createIslandsAdapter(
      createDOMHydrationAdapter(container),
      createDOMAdapter()
    );

    // Switch to fallback mode
    adapter.switchToFallback();

    // Should create new text node
    const textNode = adapter.createNode('text', { value: 'Test text' }) as Text;
    expect(textNode.textContent).toBe('Test text');
    expect(textNode.nodeType).toBe(3); // TEXT_NODE
  });

  it('should maintain the same adapter API across mode switch', () => {
    const container = document.createElement('div');
    const adapter = createIslandsAdapter(
      createDOMHydrationAdapter(container),
      createDOMAdapter()
    );

    // Get references to methods before switch
    const createNodeRef = adapter.createNode;
    const setPropertyRef = adapter.setProperty;

    // Switch mode
    adapter.switchToFallback();

    // Should still be the same method references (stable API)
    expect(adapter.createNode).toBe(createNodeRef);
    expect(adapter.setProperty).toBe(setPropertyRef);
  });

  it('should allow multiple switches to fallback (idempotent)', () => {
    const container = document.createElement('div');
    const adapter = createIslandsAdapter(
      createDOMHydrationAdapter(container),
      createDOMAdapter()
    );

    // Switch multiple times - should be safe
    adapter.switchToFallback();
    adapter.switchToFallback();
    adapter.switchToFallback();

    // Should still work
    const element = adapter.createNode('div') as HTMLElement;
    expect(element).toBeInstanceOf(HTMLElement);
  });
});
