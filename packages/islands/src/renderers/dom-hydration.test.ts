/**
 * Tests for DOM Hydration Renderer
 *
 * This test suite validates hydration-specific behaviors:
 * - Position tracking during tree traversal
 * - Fragment range detection and navigation
 * - Hydration mismatch detection
 * - Element/text node matching
 */

import { describe, it, expect } from 'vitest';
import { createDOMHydrationRenderer, HydrationMismatch } from './dom-hydration';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create element from HTML for hydration
 * The returned element is the root element being hydrated
 * Note: HTML should be compact (no whitespace) to avoid text node issues
 */
function setupHTML(html: string): HTMLElement {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.firstElementChild as HTMLElement;
}

// ============================================================================
// Tests: Basic Element Hydration
// ============================================================================

describe('Basic Element Hydration', () => {
  it('should hydrate existing element and enter its children', () => {
    const container = setupHTML('<div></div>');
    const renderer = createDOMHydrationRenderer(container);

    const div = renderer.createElement('div');

    expect(div.tagName).toBe('DIV');
    expect(div).toBe(container); // Hydrates the container itself
  });

  it('should throw on tag mismatch', () => {
    const container = setupHTML('<div></div>');
    const renderer = createDOMHydrationRenderer(container);

    expect(() => {
      renderer.createElement('span');
    }).toThrow(HydrationMismatch);
    expect(() => {
      renderer.createElement('span');
    }).toThrow('Expected <span>');
  });

  it('should hydrate nested elements in sequence', () => {
    const container = setupHTML('<div><button></button></div>');
    const renderer = createDOMHydrationRenderer(container);

    const div = renderer.createElement('div');
    const button = renderer.createElement('button');

    expect(button.tagName).toBe('BUTTON');
    expect(button.parentElement).toBe(div);
  });

  it('should hydrate sibling elements in sequence', () => {
    const container = setupHTML('<div><span></span><p></p></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');
    const span = renderer.createElement('span');

    // appendChild signals exit from span, advance to next sibling
    renderer.appendChild(span.parentElement!, span);

    const p = renderer.createElement('p');

    expect(span.tagName).toBe('SPAN');
    expect(p.tagName).toBe('P');
    expect(p.previousElementSibling).toBe(span);
  });
});

// ============================================================================
// Tests: Text Node Hydration
// ============================================================================

describe('Text Node Hydration', () => {
  it('should hydrate existing text node', () => {
    const container = setupHTML('<div>Hello</div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');
    const text = renderer.createTextNode('Hello');

    expect(text.textContent).toBe('Hello');
  });

  it('should throw on text node position mismatch', () => {
    const container = setupHTML('<div><span></span></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');

    expect(() => {
      renderer.createTextNode('text');
    }).toThrow(HydrationMismatch);
    expect(() => {
      renderer.createTextNode('text');
    }).toThrow('Expected text node');
  });

  it('should update text content if differs (data race handling)', () => {
    const container = setupHTML('<div>old</div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');
    const text = renderer.createTextNode('new');

    expect(text.textContent).toBe('new');
  });

  it('should preserve text content if matches', () => {
    const container = setupHTML('<div>same</div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');
    const text = renderer.createTextNode('same');

    expect(text.textContent).toBe('same');
  });
});

// ============================================================================
// Tests: Fragment Range Hydration
// ============================================================================

describe('Fragment Range Hydration', () => {
  it('should detect and enter fragment range', () => {
    const container = setupHTML('<div><!--fragment-start--><span>1</span><span>2</span><!--fragment-end--></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');
    const span1 = renderer.createElement('span'); // Should detect marker and enter range

    expect(span1.tagName).toBe('SPAN');
    expect(span1.textContent).toBe('1');
  });

  it('should hydrate multiple items in fragment range', () => {
    const container = setupHTML('<div><!--fragment-start--><span>a</span><span>b</span><span>c</span><!--fragment-end--></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');

    const span1 = renderer.createElement('span');
    renderer.createTextNode('a');
    renderer.appendChild(span1.parentElement!, span1);

    const span2 = renderer.createElement('span');
    renderer.createTextNode('b');
    renderer.appendChild(span2.parentElement!, span2);

    const span3 = renderer.createElement('span');
    renderer.createTextNode('c');
    renderer.appendChild(span3.parentElement!, span3);

    expect(span1.textContent).toBe('a');
    expect(span2.textContent).toBe('b');
    expect(span3.textContent).toBe('c');
  });

  it('should skip fragment marker comments when counting children', () => {
    const container = setupHTML('<div><p>before</p><!--fragment-start--><span>inside</span><!--fragment-end--><p>after</p></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');
    const p1 = renderer.createElement('p');
    renderer.appendChild(p1.parentElement!, p1);

    const span = renderer.createElement('span'); // Enters fragment
    renderer.appendChild(span.parentElement!, span); // Exits fragment

    const p2 = renderer.createElement('p');

    expect(p1.textContent).toBe('before');
    expect(span.textContent).toBe('inside');
    expect(p2.textContent).toBe('after');
  });

  it('should handle fragments that span to end of parent', () => {
    const container = setupHTML('<div><!--fragment-start--><span>a</span><span>b</span><!--fragment-end--></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');

    const span1 = renderer.createElement('span');
    renderer.appendChild(span1.parentElement!, span1);

    const span2 = renderer.createElement('span');
    renderer.appendChild(span2.parentElement!, span2);

    expect(span1.textContent).toBe('a');
    expect(span2.textContent).toBe('b');
  });

  it('should auto-exit fragment range after last item', () => {
    const container = setupHTML('<div><!--fragment-start--><span>1</span><!--fragment-end--><p>after</p></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');

    const span = renderer.createElement('span');
    renderer.appendChild(span.parentElement!, span); // Should exit range

    const p = renderer.createElement('p'); // Should be outside range

    expect(span.textContent).toBe('1');
    expect(p.textContent).toBe('after');
  });
});

// ============================================================================
// Tests: Nested Fragments
// ============================================================================

describe('Nested Fragment Ranges', () => {
  it('should handle nested fragment ranges', () => {
    const container = setupHTML('<div><!--fragment-start--><section><!--fragment-start--><span>inner</span><!--fragment-end--></section><!--fragment-end--></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');
    const section = renderer.createElement('section');
    const span = renderer.createElement('span'); // Enters inner fragment

    expect(section.tagName).toBe('SECTION');
    expect(span.textContent).toBe('inner');
  });

  it('should exit nested ranges in correct order', () => {
    const container = setupHTML('<div><!--fragment-start--><section><!--fragment-start--><span>a</span><span>b</span><!--fragment-end--></section><section><!--fragment-start--><span>c</span><!--fragment-end--></section><!--fragment-end--><p>after</p></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');

    // First outer item
    const section1 = renderer.createElement('section');
    const spanA = renderer.createElement('span'); // Inner fragment
    renderer.appendChild(spanA.parentElement!, spanA);
    const spanB = renderer.createElement('span');
    renderer.appendChild(spanB.parentElement!, spanB); // Exit inner
    renderer.appendChild(section1.parentElement!, section1); // Exit section

    // Second outer item
    const section2 = renderer.createElement('section');
    const spanC = renderer.createElement('span'); // Inner fragment
    renderer.appendChild(spanC.parentElement!, spanC); // Exit inner
    renderer.appendChild(section2.parentElement!, section2); // Exit section, exit outer

    const p = renderer.createElement('p');

    expect(spanA.textContent).toBe('a');
    expect(spanB.textContent).toBe('b');
    expect(spanC.textContent).toBe('c');
    expect(p.textContent).toBe('after');
  });
});

// ============================================================================
// Tests: Position Bookkeeping
// ============================================================================

describe('Position Bookkeeping', () => {
  it('should detect element exit via appendChild', () => {
    const container = setupHTML('<div><button>Click</button></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');
    const button = renderer.createElement('button');
    const text = renderer.createTextNode('Click');

    // appendChild with already-attached child signals exit
    renderer.appendChild(button, text);

    // Position should have exited button and advanced to next sibling
    // (would throw if we tried to create another element inside button)
  });

  it('should handle insertBefore for position tracking', () => {
    const container = setupHTML('<div><span>a</span><span>b</span></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');
    const span = renderer.createElement('span');

    // insertBefore with already-attached child signals exit
    renderer.insertBefore(span.parentElement!, span, null);

    // Should be positioned at next sibling now
    const span2 = renderer.createElement('span');
    expect(span2.textContent).toBe('b');
  });

  it('should no-op appendChild when child not in parent', () => {
    const container = setupHTML('<div></div>');
    const renderer = createDOMHydrationRenderer(container);

    const div = renderer.createElement('div');
    const orphan = document.createElement('span');

    // Should not affect position when child is not attached
    renderer.appendChild(div, orphan);
  });

  it('should no-op removeChild during hydration', () => {
    const container = setupHTML('<div><span></span></div>');
    const renderer = createDOMHydrationRenderer(container);

    const div = renderer.createElement('div');
    const span = renderer.createElement('span');

    // removeChild should be no-op
    renderer.removeChild(div, span);

    // Span should still be in DOM
    expect(div.contains(span)).toBe(true);
  });
});

// ============================================================================
// Tests: Attribute and Event Handling
// ============================================================================

describe('Attribute and Event Handling', () => {
  it('should set attributes on hydrated elements', () => {
    const container = setupHTML('<div></div>');
    const renderer = createDOMHydrationRenderer(container);

    const div = renderer.createElement('div');
    renderer.setAttribute(div, 'className', 'hydrated');

    expect(div.className).toBe('hydrated');
  });

  it('should attach event listeners to hydrated elements', () => {
    const container = setupHTML('<button>Click</button>');
    const renderer = createDOMHydrationRenderer(container);

    const button = renderer.createElement('button');

    let clicked = false;
    const cleanup = renderer.addEventListener(button, 'click', () => {
      clicked = true;
    }, {});

    button.click();
    expect(clicked).toBe(true);

    // Cleanup should remove listener
    cleanup();
    clicked = false;
    button.click();
    expect(clicked).toBe(false);
  });
});

// ============================================================================
// Tests: Complex Scenarios
// ============================================================================

describe('Complex Hydration Scenarios', () => {
  it('should hydrate deeply nested structure', () => {
    const container = setupHTML('<div><section><article><h1>Title</h1><p>Content</p></article></section></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');
    renderer.createElement('section');
    renderer.createElement('article');
    const h1 = renderer.createElement('h1');
    renderer.createTextNode('Title');
    renderer.appendChild(h1.parentElement!, h1);

    const p = renderer.createElement('p');
    renderer.createTextNode('Content');
    renderer.appendChild(p.parentElement!, p);

    expect(h1.textContent).toBe('Title');
    expect(p.textContent).toBe('Content');
  });

  it('should hydrate mixed content with fragments and elements', () => {
    const container = setupHTML('<div><header>Header</header><!--fragment-start--><section>Section 1</section><section>Section 2</section><!--fragment-end--><footer>Footer</footer></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');

    const header = renderer.createElement('header');
    renderer.createTextNode('Header');
    renderer.appendChild(header.parentElement!, header);

    const s1 = renderer.createElement('section'); // Enters fragment
    renderer.createTextNode('Section 1');
    renderer.appendChild(s1.parentElement!, s1);

    const s2 = renderer.createElement('section');
    renderer.createTextNode('Section 2');
    renderer.appendChild(s2.parentElement!, s2); // Exits fragment

    const footer = renderer.createElement('footer');
    renderer.createTextNode('Footer');

    expect(header.textContent).toBe('Header');
    expect(s1.textContent).toBe('Section 1');
    expect(s2.textContent).toBe('Section 2');
    expect(footer.textContent).toBe('Footer');
  });

  it('should handle fragment with single element', () => {
    const container = setupHTML('<div><!--fragment-start--><span>solo</span><!--fragment-end--></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');
    const span = renderer.createElement('span');
    renderer.createTextNode('solo');
    renderer.appendChild(span.parentElement!, span);

    expect(span.textContent).toBe('solo');
  });

  it('should handle empty elements', () => {
    const container = setupHTML('<div><button></button></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');
    const button = renderer.createElement('button');
    renderer.appendChild(button.parentElement!, button);

    expect(button.childNodes.length).toBe(0);
  });
});

// ============================================================================
// Tests: Error Cases
// ============================================================================

describe('Hydration Mismatch Errors', () => {
  it('should throw on missing child', () => {
    const container = setupHTML('<div></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');

    expect(() => {
      renderer.createElement('span');
    }).toThrow(HydrationMismatch);
    expect(() => {
      renderer.createElement('span');
    }).toThrow('Child at index 0 not found');
  });

  it('should throw descriptive error on element type mismatch', () => {
    const container = setupHTML('<div><!--fragment-start--><button>wrong</button><!--fragment-end--></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');

    // Mismatch errors include helpful information about what was expected vs found
    expect(() => {
      renderer.createElement('span');
    }).toThrow(HydrationMismatch);
    expect(() => {
      renderer.createElement('span');
    }).toThrow(/Expected <span>/);
  });

  it('should provide helpful error messages with path', () => {
    const container = setupHTML('<div><section><p></p></section></div>');
    const renderer = createDOMHydrationRenderer(container);

    renderer.createElement('div');
    renderer.createElement('section');

    expect(() => {
      renderer.createElement('span');
    }).toThrow('Expected <span> at 0/0');
  });
});

// ============================================================================
// Tests: Serialization (Interface Compliance)
// ============================================================================

describe('Serialization', () => {
  it('should provide serializeElement for interface compliance', () => {
    const container = setupHTML('<div class="test"></div>');
    const renderer = createDOMHydrationRenderer(container);

    const div = renderer.createElement('div');

    const html = renderer.serializeElement(div, '<p>child</p>');

    expect(html).toBe('<div class="test"><p>child</p></div>');
  });
});

// ============================================================================
// Tests: Connection Status
// ============================================================================

describe('Connection Status', () => {
  it('should report hydrated elements as connected', () => {
    const container = setupHTML('<div></div>');
    document.body.appendChild(container);
    const renderer = createDOMHydrationRenderer(container);

    const div = renderer.createElement('div');

    expect(renderer.isConnected(div)).toBe(true);

    document.body.removeChild(container);
  });
});
