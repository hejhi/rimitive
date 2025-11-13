/**
 * Tests for switchable DOM renderer
 *
 * These tests verify the mode-switching behavior of the renderer.
 * The renderer starts in hydration mode (delegating to hydrating renderer)
 * and switches to regular mode (delegating to DOM renderer) after hydration.
 */

import { describe, it, expect } from 'vitest';
import { createSwitchableDOMRenderer } from './switchable-dom';

describe('createSwitchableDOMRenderer', () => {
  it('should expose switchToRegularMode method', () => {
    const container = document.createElement('div');
    const renderer = createSwitchableDOMRenderer(container);

    expect(typeof renderer.switchToRegularMode).toBe('function');
  });

  it('should create elements after switching to regular mode', () => {
    const container = document.createElement('div');
    const renderer = createSwitchableDOMRenderer(container);

    // Switch to regular mode immediately (skipping hydration)
    renderer.switchToRegularMode();

    // Should now create a new element
    const newDiv = renderer.createElement('div');
    expect(newDiv).toBeInstanceOf(HTMLElement);
    expect(newDiv.tagName.toLowerCase()).toBe('div');
  });

  it('should create text nodes after switching to regular mode', () => {
    const container = document.createElement('div');
    const renderer = createSwitchableDOMRenderer(container);

    // Switch to regular mode
    renderer.switchToRegularMode();

    // Should create new text node
    const textNode = renderer.createTextNode('Test text');
    expect(textNode.textContent).toBe('Test text');
    expect(textNode.nodeType).toBe(3); // TEXT_NODE
  });

  it('should maintain the same renderer API across mode switch', () => {
    const container = document.createElement('div');
    const renderer = createSwitchableDOMRenderer(container);

    // Get references to methods before switch
    const createElementRef = renderer.createElement;
    const createTextNodeRef = renderer.createTextNode;
    const setAttributeRef = renderer.setAttribute;

    // Switch mode
    renderer.switchToRegularMode();

    // Should still be the same method references (stable API)
    expect(renderer.createElement).toBe(createElementRef);
    expect(renderer.createTextNode).toBe(createTextNodeRef);
    expect(renderer.setAttribute).toBe(setAttributeRef);
  });

  it('should allow multiple switches to regular mode (idempotent)', () => {
    const container = document.createElement('div');
    const renderer = createSwitchableDOMRenderer(container);

    // Switch multiple times - should be safe
    renderer.switchToRegularMode();
    renderer.switchToRegularMode();
    renderer.switchToRegularMode();

    // Should still work
    const element = renderer.createElement('div');
    expect(element).toBeInstanceOf(HTMLElement);
  });
});
