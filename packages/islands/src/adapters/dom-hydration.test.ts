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
import { createDOMHydrationAdapter, HydrationMismatch } from './dom-hydration';
import { STATUS_FRAGMENT, type FragmentRef } from '@lattice/view/types';

/**
 * Create a mock fragment ref for testing lifecycle hooks
 * The hydration renderer only checks ref.status to discriminate node types
 */
function createMockFragmentRef(): FragmentRef<Node> {
  return {
    status: STATUS_FRAGMENT,
    element: null,
    parent: null,
    prev: null,
    next: null,
    firstChild: null,
    lastChild: null,
    attach: () => undefined,
  };
}

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
    const renderer = createDOMHydrationAdapter(container);

    const div = renderer.createNode('div') as HTMLElement;

    expect(div.tagName).toBe('DIV');
    expect(div).toBe(container); // Hydrates the container itself
  });

  it('should throw on tag mismatch', () => {
    const container = setupHTML('<div></div>');
    const renderer = createDOMHydrationAdapter(container);

    expect(() => {
      renderer.createNode('span');
    }).toThrow(HydrationMismatch);
    expect(() => {
      renderer.createNode('span');
    }).toThrow('Expected <span>');
  });

  it('should hydrate nested elements in sequence', () => {
    const container = setupHTML('<div><button></button></div>');
    const renderer = createDOMHydrationAdapter(container);

    const div = renderer.createNode('div') as HTMLElement;
    const button = renderer.createNode('button') as HTMLElement;

    expect(button.tagName).toBe('BUTTON');
    expect(button.parentElement).toBe(div);
  });

  it('should hydrate sibling elements in sequence', () => {
    const container = setupHTML('<div><span></span><p></p></div>');
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');
    const span = renderer.createNode('span') as HTMLElement;

    // appendChild signals exit from span, advance to next sibling
    renderer.appendChild(span.parentElement!, span);

    const p = renderer.createNode('p') as HTMLElement;

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
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');
    const text = renderer.createNode('text', { value: 'Hello' });

    expect(text.textContent).toBe('Hello');
  });

  it('should throw on text node position mismatch', () => {
    const container = setupHTML('<div><span></span></div>');
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');

    expect(() => {
      renderer.createNode('text', { value: 'text' });
    }).toThrow(HydrationMismatch);
    expect(() => {
      renderer.createNode('text', { value: 'text' });
    }).toThrow('Expected text node');
  });

  it('should update text content if differs (data race handling)', () => {
    const container = setupHTML('<div>old</div>');
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');
    const text = renderer.createNode('text', { value: 'new' });

    expect(text.textContent).toBe('new');
  });

  it('should preserve text content if matches', () => {
    const container = setupHTML('<div>same</div>');
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');
    const text = renderer.createNode('text', { value: 'same' });

    expect(text.textContent).toBe('same');
  });
});

// ============================================================================
// Tests: Fragment Range Hydration
// ============================================================================

describe('Fragment Range Hydration', () => {
  it('should detect and enter fragment range', () => {
    const container = setupHTML(
      '<div><!--fragment-start--><span>1</span><span>2</span><!--fragment-end--></div>'
    );
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');
    const span1 = renderer.createNode('span') as HTMLElement; // Should detect marker and enter range

    expect(span1.tagName).toBe('SPAN');
    expect(span1.textContent).toBe('1');
  });

  it('should hydrate multiple items in fragment range', () => {
    const container = setupHTML(
      '<div><!--fragment-start--><span>a</span><span>b</span><span>c</span><!--fragment-end--></div>'
    );
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');

    const span1 = renderer.createNode('span') as HTMLElement;
    renderer.createNode('text', { value: 'a' });
    renderer.appendChild(span1.parentElement!, span1);

    const span2 = renderer.createNode('span') as HTMLElement;
    renderer.createNode('text', { value: 'b' });
    renderer.appendChild(span2.parentElement!, span2);

    const span3 = renderer.createNode('span') as HTMLElement;
    renderer.createNode('text', { value: 'c' });
    renderer.appendChild(span3.parentElement!, span3);

    expect(span1.textContent).toBe('a');
    expect(span2.textContent).toBe('b');
    expect(span3.textContent).toBe('c');
  });

  it('should skip fragment marker comments when counting children', () => {
    const container = setupHTML(
      '<div><p>before</p><!--fragment-start--><span>inside</span><!--fragment-end--><p>after</p></div>'
    );
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');
    const p1 = renderer.createNode('p') as HTMLElement;
    renderer.appendChild(p1.parentElement!, p1);

    const span = renderer.createNode('span') as HTMLElement; // Enters fragment
    renderer.appendChild(span.parentElement!, span); // Exits fragment

    const p2 = renderer.createNode('p') as HTMLElement;

    expect(p1.textContent).toBe('before');
    expect(span.textContent).toBe('inside');
    expect(p2.textContent).toBe('after');
  });

  it('should handle fragments that span to end of parent', () => {
    const container = setupHTML(
      '<div><!--fragment-start--><span>a</span><span>b</span><!--fragment-end--></div>'
    );
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');

    const span1 = renderer.createNode('span') as HTMLElement;
    renderer.appendChild(span1.parentElement!, span1);

    const span2 = renderer.createNode('span') as HTMLElement;
    renderer.appendChild(span2.parentElement!, span2);

    expect(span1.textContent).toBe('a');
    expect(span2.textContent).toBe('b');
  });

  it('should auto-exit fragment range after last item', () => {
    const container = setupHTML(
      '<div><!--fragment-start--><span>1</span><!--fragment-end--><p>after</p></div>'
    );
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');

    const span = renderer.createNode('span') as HTMLElement;
    renderer.appendChild(span.parentElement!, span); // Should exit range

    const p = renderer.createNode('p') as HTMLElement; // Should be outside range

    expect(span.textContent).toBe('1');
    expect(p.textContent).toBe('after');
  });
});

// ============================================================================
// Tests: Nested Fragments
// ============================================================================

describe('Nested Fragment Ranges', () => {
  it('should handle nested fragment ranges', () => {
    const container = setupHTML(
      '<div><!--fragment-start--><section><!--fragment-start--><span>inner</span><!--fragment-end--></section><!--fragment-end--></div>'
    );
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');
    const section = renderer.createNode('section') as HTMLElement;
    const span = renderer.createNode('span') as HTMLElement; // Enters inner fragment

    expect(section.tagName).toBe('SECTION');
    expect(span.textContent).toBe('inner');
  });

  it('should exit nested ranges in correct order', () => {
    const container = setupHTML(
      '<div><!--fragment-start--><section><!--fragment-start--><span>a</span><span>b</span><!--fragment-end--></section><section><!--fragment-start--><span>c</span><!--fragment-end--></section><!--fragment-end--><p>after</p></div>'
    );
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');

    // First outer item
    const section1 = renderer.createNode('section') as HTMLElement;
    const spanA = renderer.createNode('span') as HTMLElement; // Inner fragment
    renderer.appendChild(spanA.parentElement!, spanA);
    const spanB = renderer.createNode('span') as HTMLElement;
    renderer.appendChild(spanB.parentElement!, spanB); // Exit inner
    renderer.appendChild(section1.parentElement!, section1); // Exit section

    // Second outer item
    const section2 = renderer.createNode('section') as HTMLElement;
    const spanC = renderer.createNode('span') as HTMLElement; // Inner fragment
    renderer.appendChild(spanC.parentElement!, spanC); // Exit inner
    renderer.appendChild(section2.parentElement!, section2); // Exit section, exit outer

    const p = renderer.createNode('p') as HTMLElement;

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
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');
    const button = renderer.createNode('button') as HTMLElement;
    const text = renderer.createNode('text', { value: 'Click' });

    // appendChild with already-attached child signals exit
    renderer.appendChild(button, text);

    // Position should have exited button and advanced to next sibling
    // (would throw if we tried to create another element inside button)
  });

  it('should handle insertBefore for position tracking', () => {
    const container = setupHTML('<div><span>a</span><span>b</span></div>');
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');
    const span = renderer.createNode('span') as HTMLElement;

    // insertBefore with already-attached child signals exit
    renderer.insertBefore(span.parentElement!, span, null);

    // Should be positioned at next sibling now
    const span2 = renderer.createNode('span') as HTMLElement;
    expect(span2.textContent).toBe('b');
  });

  it('should no-op appendChild when child not in parent', () => {
    const container = setupHTML('<div></div>');
    const renderer = createDOMHydrationAdapter(container);

    const div = renderer.createNode('div') as HTMLElement;
    const orphan = document.createElement('span');

    // Should not affect position when child is not attached
    renderer.appendChild(div, orphan);
  });

  it('should no-op removeChild during hydration', () => {
    const container = setupHTML('<div><span></span></div>');
    const renderer = createDOMHydrationAdapter(container);

    const div = renderer.createNode('div') as HTMLElement;
    const span = renderer.createNode('span') as HTMLElement;

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
    const renderer = createDOMHydrationAdapter(container);

    const div = renderer.createNode('div') as HTMLElement;
    renderer.setProperty(div, 'className', 'hydrated');

    expect(div.className).toBe('hydrated');
  });
});

// ============================================================================
// Tests: Complex Scenarios
// ============================================================================

describe('Complex Hydration Scenarios', () => {
  it('should hydrate deeply nested structure', () => {
    const container = setupHTML(
      '<div><section><article><h1>Title</h1><p>Content</p></article></section></div>'
    );
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');
    renderer.createNode('section');
    renderer.createNode('article');
    const h1 = renderer.createNode('h1') as HTMLElement;
    renderer.createNode('text', { value: 'Title' });
    renderer.appendChild(h1.parentElement!, h1);

    const p = renderer.createNode('p') as HTMLElement;
    renderer.createNode('text', { value: 'Content' });
    renderer.appendChild(p.parentElement!, p);

    expect(h1.textContent).toBe('Title');
    expect(p.textContent).toBe('Content');
  });

  it('should hydrate mixed content with fragments and elements', () => {
    const container = setupHTML(
      '<div><header>Header</header><!--fragment-start--><section>Section 1</section><section>Section 2</section><!--fragment-end--><footer>Footer</footer></div>'
    );
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');

    const header = renderer.createNode('header') as HTMLElement;
    renderer.createNode('text', { value: 'Header' });
    renderer.appendChild(header.parentElement!, header);

    const s1 = renderer.createNode('section') as HTMLElement; // Enters fragment
    renderer.createNode('text', { value: 'Section 1' });
    renderer.appendChild(s1.parentElement!, s1);

    const s2 = renderer.createNode('section') as HTMLElement;
    renderer.createNode('text', { value: 'Section 2' });
    renderer.appendChild(s2.parentElement!, s2); // Exits fragment

    const footer = renderer.createNode('footer') as HTMLElement;
    renderer.createNode('text', { value: 'Footer' });

    expect(header.textContent).toBe('Header');
    expect(s1.textContent).toBe('Section 1');
    expect(s2.textContent).toBe('Section 2');
    expect(footer.textContent).toBe('Footer');
  });

  it('should handle fragment with single element', () => {
    const container = setupHTML(
      '<div><!--fragment-start--><span>solo</span><!--fragment-end--></div>'
    );
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');
    const span = renderer.createNode('span') as HTMLElement;
    renderer.createNode('text', { value: 'solo' });
    renderer.appendChild(span.parentElement!, span);

    expect(span.textContent).toBe('solo');
  });

  it('should handle empty elements', () => {
    const container = setupHTML('<div><button></button></div>');
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');
    const button = renderer.createNode('button') as HTMLElement;
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
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');

    expect(() => {
      renderer.createNode('span');
    }).toThrow(HydrationMismatch);
    expect(() => {
      renderer.createNode('span');
    }).toThrow('Child at index 0 not found');
  });

  it('should throw descriptive error on element type mismatch', () => {
    const container = setupHTML(
      '<div><!--fragment-start--><button>wrong</button><!--fragment-end--></div>'
    );
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');

    // Mismatch errors include helpful information about what was expected vs found
    expect(() => {
      renderer.createNode('span');
    }).toThrow(HydrationMismatch);
    expect(() => {
      renderer.createNode('span');
    }).toThrow(/Expected <span>/);
  });

  it('should provide helpful error messages with path', () => {
    const container = setupHTML('<div><section><p></p></section></div>');
    const renderer = createDOMHydrationAdapter(container);

    renderer.createNode('div');
    renderer.createNode('section');

    expect(() => {
      renderer.createNode('span');
    }).toThrow('Expected <span> at 0/0');
  });
});

// ============================================================================
// Tests: Connection Status
// ============================================================================

// ============================================================================
// Tests: Fragment Lifecycle Hooks for Deferred Fragment Content
// ============================================================================

describe('onCreate and beforeAttach for Deferred Fragment Content', () => {
  it('should skip fragment during forward pass and seek back during unwind', () => {
    // This simulates the show() hydration scenario:
    // SSR renders: <div><h2>Products</h2><section>intro</section><!--fragment-start--><h1>hello</h1><!--fragment-end--><section>filter</section></div>
    // Forward pass creates h2, section(intro), skips show() fragment via onCreate, section(filter)
    // Unwind calls beforeAttach before show().attach() creates the h1
    const container = setupHTML(
      '<div><h2>Products</h2><section>intro</section><!--fragment-start--><h1>hello</h1><!--fragment-end--><section>filter</section></div>'
    );
    const renderer = createDOMHydrationAdapter(container);
    const mockFragRef = createMockFragmentRef();

    // Forward pass: create div
    const div = renderer.createNode('div') as HTMLElement;

    // Forward pass: create h2 and exit
    const h2 = renderer.createNode('h2') as HTMLElement;
    renderer.createNode('text', { value: 'Products' });
    renderer.appendChild(div, h2);

    // Forward pass: create section (intro) and exit
    const sectionIntro = renderer.createNode('section') as HTMLElement;
    renderer.createNode('text', { value: 'intro' });
    renderer.appendChild(div, sectionIntro);

    // Forward pass: SKIP show() fragment
    // processChildren calls onCreate to advance position past fragment content
    renderer.onCreate?.(mockFragRef, div);

    // Forward pass: create section (filter) and exit
    const sectionFilter = renderer.createNode('section') as HTMLElement;
    renderer.createNode('text', { value: 'filter' });
    renderer.appendChild(div, sectionFilter);

    // Now we're at the UNWIND phase
    // Before show().attach(), we call beforeAttach to reset position
    renderer.beforeAttach?.(mockFragRef, div, sectionFilter);

    // Now show().attach() creates the deferred h1 content
    const h1 = renderer.createNode('h1') as HTMLElement;
    renderer.createNode('text', { value: 'hello' });
    renderer.appendChild(div, h1);

    // Verify we got the right elements
    expect(h2.textContent).toBe('Products');
    expect(sectionIntro.textContent).toBe('intro');
    expect(h1.textContent).toBe('hello');
    expect(sectionFilter.textContent).toBe('filter');
  });

  it('should skip fragment at beginning of parent', () => {
    const container = setupHTML(
      '<div><!--fragment-start--><h1>first</h1><!--fragment-end--><section>after</section></div>'
    );
    const renderer = createDOMHydrationAdapter(container);
    const mockFragRef = createMockFragmentRef();

    const div = renderer.createNode('div') as HTMLElement;

    // Forward pass: skip the fragment
    renderer.onCreate?.(mockFragRef, div);

    // Forward pass: create section
    const section = renderer.createNode('section') as HTMLElement;
    renderer.createNode('text', { value: 'after' });
    renderer.appendChild(div, section);

    // Unwind: seek back to fragment position
    renderer.beforeAttach?.(mockFragRef, div, section);

    // Create deferred fragment content
    const h1 = renderer.createNode('h1') as HTMLElement;
    renderer.createNode('text', { value: 'first' });
    renderer.appendChild(div, h1);

    expect(h1.textContent).toBe('first');
    expect(section.textContent).toBe('after');
  });

  it('should handle fragment at end of parent (no next sibling)', () => {
    const container = setupHTML(
      '<div><section>before</section><!--fragment-start--><h1>last</h1><!--fragment-end--></div>'
    );
    const renderer = createDOMHydrationAdapter(container);
    const mockFragRef = createMockFragmentRef();

    const div = renderer.createNode('div') as HTMLElement;

    // Forward pass: create section
    const section = renderer.createNode('section') as HTMLElement;
    renderer.createNode('text', { value: 'before' });
    renderer.appendChild(div, section);

    // Forward pass: skip fragment (it's last, no next sibling after it)
    renderer.onCreate?.(mockFragRef, div);

    // Unwind: seek to fragment position (nextSibling is null)
    renderer.beforeAttach?.(mockFragRef, div, null);

    // Create deferred fragment content
    const h1 = renderer.createNode('h1') as HTMLElement;
    renderer.createNode('text', { value: 'last' });
    renderer.appendChild(div, h1);

    expect(section.textContent).toBe('before');
    expect(h1.textContent).toBe('last');
  });

  it('should handle multiple adjacent fragments', () => {
    const container = setupHTML(
      '<div><h2>title</h2><!--fragment-start--><p>frag1</p><!--fragment-end--><!--fragment-start--><span>frag2</span><!--fragment-end--><footer>end</footer></div>'
    );
    const renderer = createDOMHydrationAdapter(container);
    const mockFragRef = createMockFragmentRef();

    const div = renderer.createNode('div') as HTMLElement;

    // Forward pass: h2
    const h2 = renderer.createNode('h2') as HTMLElement;
    renderer.createNode('text', { value: 'title' });
    renderer.appendChild(div, h2);

    // Forward pass: skip first fragment
    renderer.onCreate?.(mockFragRef, div);

    // Forward pass: skip second fragment
    renderer.onCreate?.(mockFragRef, div);

    // Forward pass: create footer
    const footer = renderer.createNode('footer') as HTMLElement;
    renderer.createNode('text', { value: 'end' });
    renderer.appendChild(div, footer);

    // Unwind: seek to second fragment (closer to footer)
    renderer.beforeAttach?.(mockFragRef, div, footer);

    // Create second fragment content
    const span = renderer.createNode('span') as HTMLElement;
    renderer.createNode('text', { value: 'frag2' });
    renderer.appendChild(div, span);

    // Seek to first fragment
    renderer.beforeAttach?.(mockFragRef, div, span);

    // Create first fragment content
    const p = renderer.createNode('p') as HTMLElement;
    renderer.createNode('text', { value: 'frag1' });
    renderer.appendChild(div, p);

    expect(h2.textContent).toBe('title');
    expect(p.textContent).toBe('frag1');
    expect(span.textContent).toBe('frag2');
    expect(footer.textContent).toBe('end');
  });

  it('should handle nested fragments (fragment inside fragment content)', () => {
    // This replicates the real-world scenario:
    // - Route match fragment wraps the entire page
    // - Inside the page, show() fragment contains conditional content
    //
    // HTML structure:
    // <main>
    //   <!--fragment-start-->  (route match)
    //   <div class="products-page">
    //     <h2>Products</h2>
    //     <section>intro</section>
    //     <!--fragment-start--><h1>hello</h1><!--fragment-end-->  (show)
    //     <section>filter</section>
    //   </div>
    //   <!--fragment-end-->
    // </main>
    const container = setupHTML(
      '<main><!--fragment-start--><div><h2>Products</h2><section>intro</section><!--fragment-start--><h1>hello</h1><!--fragment-end--><section>filter</section></div><!--fragment-end--></main>'
    );
    const renderer = createDOMHydrationAdapter(container);
    const mockFragRef = createMockFragmentRef();

    // Enter main
    const main = renderer.createNode('main') as HTMLElement;

    // Forward pass at main level: skip route match fragment
    renderer.onCreate?.(mockFragRef, main);

    // === UNWIND at main level ===
    // Seek to route match fragment position, then process its content
    renderer.beforeAttach?.(mockFragRef, main, null);

    // Route match attach() creates the div and processes its content
    const div = renderer.createNode('div') as HTMLElement;

    // Forward pass at div level: h2
    const h2 = renderer.createNode('h2') as HTMLElement;
    renderer.createNode('text', { value: 'Products' });
    renderer.appendChild(div, h2);

    // Forward pass at div level: section(intro)
    const sectionIntro = renderer.createNode('section') as HTMLElement;
    renderer.createNode('text', { value: 'intro' });
    renderer.appendChild(div, sectionIntro);

    // Forward pass at div level: skip show() fragment
    renderer.onCreate?.(mockFragRef, div);

    // Forward pass at div level: section(filter)
    const sectionFilter = renderer.createNode('section') as HTMLElement;
    renderer.createNode('text', { value: 'filter' });
    renderer.appendChild(div, sectionFilter);

    // === UNWIND at div level ===
    // Seek to show() fragment position
    renderer.beforeAttach?.(mockFragRef, div, sectionFilter);

    // show() attach() creates the h1
    const h1 = renderer.createNode('h1') as HTMLElement;
    renderer.createNode('text', { value: 'hello' });
    renderer.appendChild(div, h1);

    // Exit div (back to main level)
    renderer.appendChild(main, div);

    // Verify all elements
    expect(h2.textContent).toBe('Products');
    expect(sectionIntro.textContent).toBe('intro');
    expect(h1.textContent).toBe('hello');
    expect(sectionFilter.textContent).toBe('filter');
  });

  it('should handle hidden/empty fragments (no markers in DOM)', () => {
    // This replicates the router scenario where multiple show() fragments exist,
    // but only the active route renders markers. Hidden routes have no markers.
    //
    // Router children: [show(Home), show(About), show(Products)]
    // Only Products is visible, so DOM has:
    // <main>
    //   <!--fragment-start--><div>Products page</div><!--fragment-end-->
    // </main>
    // But client code has 3 show() fragments
    const container = setupHTML(
      '<main><!--fragment-start--><div>Products page</div><!--fragment-end--></main>'
    );
    const renderer = createDOMHydrationAdapter(container);
    const mockFragRef = createMockFragmentRef();

    // Enter main
    const main = renderer.createNode('main') as HTMLElement;

    // Forward pass: skip show(Home) - but it has NO markers in DOM!
    // onCreate should handle this gracefully
    renderer.onCreate?.(mockFragRef, main);

    // Forward pass: skip show(About) - also no markers
    renderer.onCreate?.(mockFragRef, main);

    // Forward pass: skip show(Products) - this one HAS markers
    renderer.onCreate?.(mockFragRef, main);

    // === UNWIND phase ===
    // Seek to show(Products) - has markers, should work
    renderer.beforeAttach?.(mockFragRef, main, null);

    // Products attach() creates the div
    const productsDiv = renderer.createNode('div') as HTMLElement;
    renderer.createNode('text', { value: 'Products page' });
    renderer.appendChild(main, productsDiv);

    // Seek to show(About) - NO markers, should be no-op
    // nextSibling is productsDiv
    renderer.beforeAttach?.(mockFragRef, main, productsDiv);
    // About attach() does nothing (condition false, no content to create)

    // Seek to show(Home) - NO markers, should be no-op
    // nextSibling is still productsDiv (About created nothing)
    renderer.beforeAttach?.(mockFragRef, main, productsDiv);
    // Home attach() does nothing (condition false, no content to create)

    // Verify Products page hydrated correctly
    expect(productsDiv.textContent).toBe('Products page');
  });
});

// ============================================================================
// Integration Tests: Full View API with Hydration
// ============================================================================

import { createSignalsSvc } from '@lattice/signals/presets/core';
import { createViewSvc } from '@lattice/view/presets/core';
import { STATUS_ELEMENT, type ElementRef } from '@lattice/view/types'; // Separate import for integration tests

describe('Integration: match() hydration with full view API', () => {
  const setupIntegrationHTML = (html: string): HTMLElement => {
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
    return div.firstElementChild as HTMLElement;
  };

  it('should hydrate match() fragment correctly with real view API', () => {
    // This replicates the Products page scenario:
    // <div class="products-page">
    //   <h2>Products</h2>
    //   <section class="intro">intro</section>
    //   <!--fragment-start--><h1>hello</h1><!--fragment-end-->
    //   <section class="filter">filter</section>
    // </div>
    const container = setupIntegrationHTML(
      '<div class="products-page"><h2>Products</h2><section class="intro">intro</section><!--fragment-start--><h1>hello</h1><!--fragment-end--><section class="filter">filter</section></div>'
    );

    const renderer = createDOMHydrationAdapter(container);
    const signals = createSignalsSvc();
    const views = createViewSvc(renderer, signals);

    // Combine signals and views to get full API
    const svc = { ...signals, ...views };
    const { el, match, computed } = svc;

    // Create the component spec matching the SSR output
    const pageSpec = el('div').props({ className: 'products-page' })(
      el('h2')('Products'),
      el('section').props({ className: 'intro' })('intro'),
      match(
        computed(() => true),
        (visible) => (visible ? el('h1')('hello') : null)
      ),
      el('section').props({ className: 'filter' })('filter')
    );

    // Hydrate
    const nodeRef = pageSpec.create(svc);

    // Verify hydration succeeded
    expect(nodeRef.status).toBe(STATUS_ELEMENT);
    const pageDiv = (nodeRef as ElementRef<HTMLElement>).element;
    expect(pageDiv.className).toBe('products-page');

    // Verify all children are present and in correct order
    const children = Array.from(pageDiv.children);
    expect(children[0]?.tagName).toBe('H2');
    expect(children[0]?.textContent).toBe('Products');
    expect(children[1]?.tagName).toBe('SECTION');
    expect((children[1] as HTMLElement)?.className).toBe('intro');
    expect(children[2]?.tagName).toBe('H1');
    expect(children[2]?.textContent).toBe('hello');
    expect(children[3]?.tagName).toBe('SECTION');
    expect((children[3] as HTMLElement)?.className).toBe('filter');

    document.body.removeChild(container.parentElement!);
  });

  it('should hydrate nested match() inside route match fragment (real app structure)', () => {
    // This replicates the FULL app structure:
    // <div class="app">
    //   <nav>nav</nav>
    //   <main>
    //     <!--fragment-start-->  (route match)
    //     <div class="products-page">
    //       <h2>Products</h2>
    //       <section class="intro">intro</section>
    //       <!--fragment-start--><h1>hello</h1><!--fragment-end-->  (show)
    //       <section class="filter">filter</section>
    //     </div>
    //     <!--fragment-end-->
    //   </main>
    // </div>
    const container = setupIntegrationHTML(
      '<div class="app"><nav>nav</nav><main><!--fragment-start--><div class="products-page"><h2>Products</h2><section class="intro">intro</section><!--fragment-start--><h1>hello</h1><!--fragment-end--><section class="filter">filter</section></div><!--fragment-end--></main></div>'
    );

    const renderer = createDOMHydrationAdapter(container);
    const signals = createSignalsSvc();
    const views = createViewSvc(renderer, signals);

    // Combine signals and views to get full API
    const svc = { ...signals, ...views };
    const { el, computed, match } = svc;

    // Build the Products page component
    const ProductsPage = () =>
      el('div').props({ className: 'products-page' })(
        el('h2')('Products'),
        el('section').props({ className: 'intro' })('intro'),
        match(
          computed(() => true),
          (visible) => (visible ? el('h1')('hello') : null)
        ),
        el('section').props({ className: 'filter' })('filter')
      );

    // Build the app structure with route match
    // match(reactive, (value) => RefSpec | null) - renders content based on value
    const appSpec = el('div').props({ className: 'app' })(
      el('nav')('nav'),
      el('main')(
        match(
          computed(() => 'products'),
          (value) => (value === 'products' ? ProductsPage() : null)
        )
      )
    );

    // Hydrate
    const nodeRef = appSpec.create(svc);

    // Verify hydration succeeded
    expect(nodeRef.status).toBe(STATUS_ELEMENT);
    const appDiv = (nodeRef as ElementRef<HTMLElement>).element;
    expect(appDiv.className).toBe('app');

    // Navigate to find the products page
    const main = appDiv.querySelector('main');
    const productsPage = main?.querySelector('.products-page');
    expect(productsPage).toBeTruthy();

    // Verify products page children are in correct order
    const children = Array.from(productsPage!.children);
    expect(children[0]?.tagName).toBe('H2');
    expect(children[1]?.tagName).toBe('SECTION');
    expect(children[1]?.className).toBe('intro');
    expect(children[2]?.tagName).toBe('H1');
    expect(children[2]?.textContent).toBe('hello');
    expect(children[3]?.tagName).toBe('SECTION');
    expect(children[3]?.className).toBe('filter');

    document.body.removeChild(container.parentElement!);
  });
});
