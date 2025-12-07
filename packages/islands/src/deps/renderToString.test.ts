/**
 * Tests for island-aware renderToString
 *
 * Tests HTML serialization of NodeRef trees:
 * - Element rendering via outerHTML
 * - Fragment rendering via child concatenation
 * - Error handling for invalid nodes
 * - Edge cases (empty fragments, nested structures)
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from './renderToString';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';
import type { NodeRef, ElementRef, FragmentRef } from '@lattice/view/types';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a mock element ref with outerHTML
 */
function createElementRef(html: string): ElementRef<unknown> {
  return {
    status: STATUS_ELEMENT,
    element: { outerHTML: html },
    parent: null,
    prev: null,
    next: null,
    firstChild: null,
    lastChild: null,
  };
}

/**
 * Create a mock fragment ref with children
 */
function createFragmentRef(children: NodeRef<unknown>[]): FragmentRef<unknown> {
  // Link children together
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const next = children[i + 1];
    if (child) {
      child.prev = i > 0 ? children[i - 1]! : null;
      child.next = next || null;
    }
  }

  return {
    status: STATUS_FRAGMENT,
    element: null,
    parent: null,
    prev: null,
    next: null,
    firstChild: children[0] || null,
    lastChild: children[children.length - 1] || null,
    attach: () => {},
  };
}

/**
 * Create an element ref without outerHTML (invalid)
 */
function createInvalidElementRef(): ElementRef<unknown> {
  return {
    status: STATUS_ELEMENT,
    element: {}, // No outerHTML property
    parent: null,
    prev: null,
    next: null,
    firstChild: null,
    lastChild: null,
  };
}

// ============================================================================
// Tests: Element Rendering
// ============================================================================

describe('Element Rendering', () => {
  it('should render element via outerHTML', () => {
    const element = createElementRef('<div class="test">Hello</div>');
    const result = renderToString(element);

    expect(result).toBe('<div class="test">Hello</div>');
  });

  it('should render self-closing element', () => {
    const element = createElementRef('<img src="test.jpg" />');
    const result = renderToString(element);

    expect(result).toBe('<img src="test.jpg" />');
  });

  it('should render element with attributes', () => {
    const element = createElementRef(
      '<button type="button" disabled>Click</button>'
    );
    const result = renderToString(element);

    expect(result).toBe('<button type="button" disabled>Click</button>');
  });

  it('should render element with nested children', () => {
    const element = createElementRef('<ul><li>Item 1</li><li>Item 2</li></ul>');
    const result = renderToString(element);

    expect(result).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
  });

  it('should throw error when element lacks outerHTML', () => {
    const element = createInvalidElementRef();

    expect(() => renderToString(element)).toThrow(
      'Element does not have outerHTML property'
    );
    expect(() => renderToString(element)).toThrow(
      'Are you using linkedom renderer?'
    );
  });
});

// ============================================================================
// Tests: Fragment Rendering
// ============================================================================

describe('Fragment Rendering', () => {
  it('should render fragment by concatenating children', () => {
    const fragment = createFragmentRef([
      createElementRef('<span>First</span>'),
      createElementRef('<span>Second</span>'),
    ]);

    const result = renderToString(fragment);

    expect(result).toBe('<span>First</span><span>Second</span>');
  });

  it('should render empty fragment as empty string', () => {
    const fragment = createFragmentRef([]);

    const result = renderToString(fragment);

    expect(result).toBe('');
  });

  it('should render fragment with single child', () => {
    const fragment = createFragmentRef([
      createElementRef('<div>Only child</div>'),
    ]);

    const result = renderToString(fragment);

    expect(result).toBe('<div>Only child</div>');
  });

  it('should render fragment with many children', () => {
    const fragment = createFragmentRef([
      createElementRef('<h1>Title</h1>'),
      createElementRef('<p>Paragraph 1</p>'),
      createElementRef('<p>Paragraph 2</p>'),
      createElementRef('<footer>Footer</footer>'),
    ]);

    const result = renderToString(fragment);

    expect(result).toBe(
      '<h1>Title</h1><p>Paragraph 1</p><p>Paragraph 2</p><footer>Footer</footer>'
    );
  });
});

// ============================================================================
// Tests: Nested Fragments
// ============================================================================

describe('Nested Fragments', () => {
  it('should render fragment containing fragments', () => {
    const innerFragment1 = createFragmentRef([
      createElementRef('<span>A</span>'),
      createElementRef('<span>B</span>'),
    ]);

    const innerFragment2 = createFragmentRef([
      createElementRef('<span>C</span>'),
      createElementRef('<span>D</span>'),
    ]);

    const outerFragment = createFragmentRef([innerFragment1, innerFragment2]);

    const result = renderToString(outerFragment);

    expect(result).toBe(
      '<span>A</span><span>B</span><span>C</span><span>D</span>'
    );
  });

  it('should render deeply nested fragments', () => {
    const level3 = createFragmentRef([createElementRef('<i>Deep</i>')]);

    const level2 = createFragmentRef([createElementRef('<b>Mid</b>'), level3]);

    const level1 = createFragmentRef([
      createElementRef('<span>Top</span>'),
      level2,
    ]);

    const result = renderToString(level1);

    expect(result).toBe('<span>Top</span><b>Mid</b><i>Deep</i>');
  });

  it('should render fragment with mixed element and fragment children', () => {
    const innerFragment = createFragmentRef([
      createElementRef('<em>Italic</em>'),
      createElementRef('<strong>Bold</strong>'),
    ]);

    const outerFragment = createFragmentRef([
      createElementRef('<h2>Header</h2>'),
      innerFragment,
      createElementRef('<p>Paragraph</p>'),
    ]);

    const result = renderToString(outerFragment);

    expect(result).toBe(
      '<h2>Header</h2><em>Italic</em><strong>Bold</strong><p>Paragraph</p>'
    );
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should return empty string for unknown node type', () => {
    // Create a node with invalid status by casting
    const unknownNode = {
      status: 999, // Invalid status
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    } as unknown as NodeRef<unknown>;

    const result = renderToString(unknownNode);

    expect(result).toBe('');
  });

  it('should handle element with empty outerHTML', () => {
    const element = createElementRef('');

    const result = renderToString(element);

    expect(result).toBe('');
  });

  it('should preserve HTML special characters', () => {
    const element = createElementRef(
      '<div>&lt;script&gt;alert("XSS")&lt;/script&gt;</div>'
    );

    const result = renderToString(element);

    expect(result).toBe('<div>&lt;script&gt;alert("XSS")&lt;/script&gt;</div>');
  });

  it('should preserve whitespace in HTML', () => {
    const element = createElementRef('<pre>  Line 1\n  Line 2  </pre>');

    const result = renderToString(element);

    expect(result).toBe('<pre>  Line 1\n  Line 2  </pre>');
  });
});

// ============================================================================
// Tests: Island Markers
// ============================================================================

describe('Island Markers', () => {
  it('should preserve island script tags in element HTML', () => {
    const element = createElementRef(
      '<div data-island-id="counter-1">Count: 5</div><script type="application/json" data-island="counter-1"></script>'
    );

    const result = renderToString(element);

    expect(result).toContain('data-island-id="counter-1"');
    expect(result).toContain('data-island="counter-1"');
  });

  it('should preserve fragment boundary comments', () => {
    const fragment = createFragmentRef([
      createElementRef('<!--fragment-start-->'),
      createElementRef('<span>Item 1</span>'),
      createElementRef('<span>Item 2</span>'),
      createElementRef('<!--fragment-end-->'),
    ]);

    const result = renderToString(fragment);

    expect(result).toContain('<!--fragment-start-->');
    expect(result).toContain('<!--fragment-end-->');
  });

  it('should preserve island wrapper divs for fragments', () => {
    const element = createElementRef(
      '<div><!--fragment-start--><span>A</span><span>B</span><!--fragment-end--><script type="application/json" data-island="tags-1"></script></div>'
    );

    const result = renderToString(element);

    expect(result).toContain('<!--fragment-start-->');
    expect(result).toContain('<!--fragment-end-->');
    expect(result).toContain('data-island="tags-1"');
  });
});

// ============================================================================
// Tests: Rendering Invariants
// ============================================================================

describe('Rendering Invariants', () => {
  it('should satisfy: fragment with N children produces N HTML strings concatenated', () => {
    const children = [
      createElementRef('<a>1</a>'),
      createElementRef('<b>2</b>'),
      createElementRef('<c>3</c>'),
    ];

    const fragment = createFragmentRef(children);
    const result = renderToString(fragment);

    const expected = children.map((c) => renderToString(c)).join('');
    expect(result).toBe(expected);
  });

  it('should satisfy: rendering is idempotent (same input produces same output)', () => {
    const element = createElementRef('<div class="test">Content</div>');

    const result1 = renderToString(element);
    const result2 = renderToString(element);

    expect(result1).toBe(result2);
  });

  it('should satisfy: empty fragment renders as empty string', () => {
    const fragment = createFragmentRef([]);

    const result = renderToString(fragment);

    expect(result).toBe('');
    expect(result.length).toBe(0);
  });

  it('should satisfy: fragment rendering is order-preserving', () => {
    const children = [
      createElementRef('<first />'),
      createElementRef('<second />'),
      createElementRef('<third />'),
    ];

    const fragment = createFragmentRef(children);
    const result = renderToString(fragment);

    expect(result.indexOf('<first')).toBeLessThan(result.indexOf('<second'));
    expect(result.indexOf('<second')).toBeLessThan(result.indexOf('<third'));
  });
});
