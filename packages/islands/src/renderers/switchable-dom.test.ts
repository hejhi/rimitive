/**
 * Tests for hydrating renderer
 *
 * These tests verify the mode-switching behavior of the renderer.
 * The renderer starts by delegating to the hydrating renderer
 * and switches to the fallback renderer after hydration.
 */

import { describe, it, expect } from 'vitest';
import { createHydratingRenderer } from './switchable-dom';
import { createHydratingDOMRenderer } from './hydrating-dom';
import { createDOMRenderer } from '@lattice/view/renderers/dom';

describe('createHydratingRenderer', () => {
  it('should expose switchToFallback method', () => {
    const container = document.createElement('div');
    const renderer = createHydratingRenderer(
      createHydratingDOMRenderer(container),
      createDOMRenderer()
    );

    expect(typeof renderer.switchToFallback).toBe('function');
  });

  it('should create elements after switching to fallback', () => {
    const container = document.createElement('div');
    const renderer = createHydratingRenderer(
      createHydratingDOMRenderer(container),
      createDOMRenderer()
    );

    // Switch to fallback immediately (skipping hydration)
    renderer.switchToFallback();

    // Should now create a new element
    const newDiv = renderer.createElement('div');
    expect(newDiv).toBeInstanceOf(HTMLElement);
    expect(newDiv.tagName.toLowerCase()).toBe('div');
  });

  it('should create text nodes after switching to fallback', () => {
    const container = document.createElement('div');
    const renderer = createHydratingRenderer(
      createHydratingDOMRenderer(container),
      createDOMRenderer()
    );

    // Switch to fallback mode
    renderer.switchToFallback();

    // Should create new text node
    const textNode = renderer.createTextNode('Test text');
    expect(textNode.textContent).toBe('Test text');
    expect(textNode.nodeType).toBe(3); // TEXT_NODE
  });

  it('should maintain the same renderer API across mode switch', () => {
    const container = document.createElement('div');
    const renderer = createHydratingRenderer(
      createHydratingDOMRenderer(container),
      createDOMRenderer()
    );

    // Get references to methods before switch
    const createElementRef = renderer.createElement;
    const createTextNodeRef = renderer.createTextNode;
    const setAttributeRef = renderer.setAttribute;

    // Switch mode
    renderer.switchToFallback();

    // Should still be the same method references (stable API)
    expect(renderer.createElement).toBe(createElementRef);
    expect(renderer.createTextNode).toBe(createTextNodeRef);
    expect(renderer.setAttribute).toBe(setAttributeRef);
  });

  it('should allow multiple switches to fallback (idempotent)', () => {
    const container = document.createElement('div');
    const renderer = createHydratingRenderer(
      createHydratingDOMRenderer(container),
      createDOMRenderer()
    );

    // Switch multiple times - should be safe
    renderer.switchToFallback();
    renderer.switchToFallback();
    renderer.switchToFallback();

    // Should still work
    const element = renderer.createElement('div');
    expect(element).toBeInstanceOf(HTMLElement);
  });
});
