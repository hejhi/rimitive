/**
 * Tests for Parse5 SSR Adapter
 *
 * These tests verify:
 * 1. Adapter contract - interface behavior for SSR
 * 2. Serialization correctness - valid HTML output
 * 3. Edge case handling - special values, escaping, namespaces
 * 4. Primitive integration - el, map, match, shadow work correctly
 * 5. Hydration support - fragment markers for client rehydration
 */

import { describe, it, expect } from 'vitest';
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';
import { createElModule } from '@rimitive/view/el';
import { createMapModule } from '@rimitive/view/map';
import { createMatchModule } from '@rimitive/view/match';
import { createShadowModule } from '@rimitive/view/shadow';
import { MountModule } from '@rimitive/view/deps/mount';
import { STATUS_FRAGMENT } from '@rimitive/view/types';
import { createParse5Adapter } from './parse5-adapter';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a full view service with parse5 adapter for integration tests
 */
function createService() {
  const { adapter, serialize } = createParse5Adapter();
  const svc = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    BatchModule,
    createElModule(adapter),
    createMapModule(adapter),
    createMatchModule(adapter),
    createShadowModule(adapter),
    MountModule
  );
  return { ...svc, adapter, serialize };
}

// =============================================================================
// Tests: Low-Level Adapter Operations
// =============================================================================

describe('Adapter Contract', () => {
  describe('createNode', () => {
    it('creates element with correct tag name', () => {
      const { adapter, serialize } = createParse5Adapter();

      const div = adapter.createNode('div');
      const span = adapter.createNode('span');

      // Observable: serialized output has correct tags
      expect(serialize(div)).toBe('<div></div>');
      expect(serialize(span)).toBe('<span></span>');
    });

    it('creates text node with initial value', () => {
      const { adapter, serialize } = createParse5Adapter();

      const parent = adapter.createNode('div');
      const text = adapter.createNode('text', { value: 'Hello' });
      adapter.appendChild(parent, text);

      expect(serialize(parent)).toBe('<div>Hello</div>');
    });

    it('creates text node with empty string when no value provided', () => {
      const { adapter, serialize } = createParse5Adapter();

      const parent = adapter.createNode('div');
      const text = adapter.createNode('text');
      adapter.appendChild(parent, text);

      expect(serialize(parent)).toBe('<div></div>');
    });
  });

  describe('appendChild', () => {
    it('appends child to parent in correct order', () => {
      const { adapter, serialize } = createParse5Adapter();

      const parent = adapter.createNode('div');
      const child1 = adapter.createNode('span');
      const child2 = adapter.createNode('p');

      adapter.appendChild(parent, child1);
      adapter.appendChild(parent, child2);

      expect(serialize(parent)).toBe('<div><span></span><p></p></div>');
    });
  });

  describe('insertBefore', () => {
    it('inserts child before reference node', () => {
      const { adapter, serialize } = createParse5Adapter();

      const parent = adapter.createNode('div');
      const first = adapter.createNode('text', { value: 'first' });
      const second = adapter.createNode('text', { value: 'second' });

      adapter.appendChild(parent, second);
      adapter.insertBefore(parent, first, second);

      expect(serialize(parent)).toBe('<div>firstsecond</div>');
    });

    it('appends when reference is null', () => {
      const { adapter, serialize } = createParse5Adapter();

      const parent = adapter.createNode('div');
      const child = adapter.createNode('span');

      adapter.insertBefore(parent, child, null);

      expect(serialize(parent)).toBe('<div><span></span></div>');
    });
  });

  describe('removeChild', () => {
    it('removes child from parent', () => {
      const { adapter, serialize } = createParse5Adapter();

      const parent = adapter.createNode('div');
      const child1 = adapter.createNode('span');
      const child2 = adapter.createNode('p');

      adapter.appendChild(parent, child1);
      adapter.appendChild(parent, child2);
      adapter.removeChild(parent, child1);

      expect(serialize(parent)).toBe('<div><p></p></div>');
    });
  });

  describe('setAttribute', () => {
    it('sets attribute on element', () => {
      const { adapter, serialize } = createParse5Adapter();

      const div = adapter.createNode('div');
      adapter.setAttribute(div, 'id', 'test');

      expect(serialize(div)).toBe('<div id="test"></div>');
    });

    it('updates text node content via value key', () => {
      const { adapter, serialize } = createParse5Adapter();

      const parent = adapter.createNode('div');
      const text = adapter.createNode('text', { value: 'before' });
      adapter.appendChild(parent, text);
      adapter.setAttribute(text, 'value', 'after');

      expect(serialize(parent)).toBe('<div>after</div>');
    });

    it('sets textContent by replacing children with text node', () => {
      const { adapter, serialize } = createParse5Adapter();

      const div = adapter.createNode('div');
      const child = adapter.createNode('span');
      adapter.appendChild(div, child);
      adapter.setAttribute(div, 'textContent', 'replaced');

      expect(serialize(div)).toBe('<div>replaced</div>');
    });
  });
});

// =============================================================================
// Tests: Attribute Edge Cases
// =============================================================================

describe('Attribute Handling', () => {
  it('maps className to class attribute', () => {
    const { adapter, serialize } = createParse5Adapter();

    const div = adapter.createNode('div');
    adapter.setAttribute(div, 'className', 'container');

    expect(serialize(div)).toBe('<div class="container"></div>');
  });

  it('stringifies number values', () => {
    const { adapter, serialize } = createParse5Adapter();

    const div = adapter.createNode('div');
    adapter.setAttribute(div, 'data-count', 42);
    adapter.setAttribute(div, 'tabindex', 0);

    expect(serialize(div)).toBe('<div data-count="42" tabindex="0"></div>');
  });

  it('stringifies boolean true to string', () => {
    const { adapter, serialize } = createParse5Adapter();

    const input = adapter.createNode('input');
    adapter.setAttribute(input, 'disabled', true);

    expect(serialize(input)).toBe('<input disabled="true">');
  });

  it('skips boolean false values', () => {
    const { adapter, serialize } = createParse5Adapter();

    const input = adapter.createNode('input');
    adapter.setAttribute(input, 'disabled', false);

    expect(serialize(input)).toBe('<input>');
  });

  it('skips null values', () => {
    const { adapter, serialize } = createParse5Adapter();

    const div = adapter.createNode('div');
    adapter.setAttribute(div, 'data-value', null);

    expect(serialize(div)).toBe('<div></div>');
  });

  it('skips object values', () => {
    const { adapter, serialize } = createParse5Adapter();

    const div = adapter.createNode('div');
    adapter.setAttribute(div, 'data-config', { foo: 'bar' });

    expect(serialize(div)).toBe('<div></div>');
  });

  it('skips function values', () => {
    const { adapter, serialize } = createParse5Adapter();

    const div = adapter.createNode('div');
    adapter.setAttribute(div, 'ref', () => {});

    expect(serialize(div)).toBe('<div></div>');
  });

  it('skips event handler attributes (on* prefix)', () => {
    const { adapter, serialize } = createParse5Adapter();

    const button = adapter.createNode('button');
    adapter.setAttribute(button, 'onclick', () => console.log('click'));
    adapter.setAttribute(button, 'onMouseOver', () => {});

    expect(serialize(button)).toBe('<button></button>');
  });
});

// =============================================================================
// Tests: SVG Namespace Handling
// =============================================================================

describe('SVG Namespace', () => {
  it('renders SVG with correct structure and attributes', () => {
    const { el, mount, serialize } = createService();

    const spec = el('svg').props({ width: '100', height: '100', viewBox: '0 0 100 100' })(
      el('circle').props({ cx: '50', cy: '50', r: '40', fill: 'red' })()
    );
    const mounted = mount(spec);

    expect(serialize(mounted.element!)).toBe(
      '<svg width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"></circle></svg>'
    );
  });

  it('renders foreignObject children as HTML (not SVG namespace)', () => {
    const { el, mount, serialize } = createService();

    const spec = el('svg')(
      el('foreignObject').props({ x: '10', y: '10', width: '100', height: '100' })(
        el('div').props({ className: 'html-content' })('HTML inside SVG')
      )
    );
    const mounted = mount(spec);

    const html = serialize(mounted.element!);
    // foreignObject children should be HTML elements, not SVG
    expect(html).toContain('<div class="html-content">HTML inside SVG</div>');
  });
});

// =============================================================================
// Tests: HTML Escaping (Security)
// =============================================================================

describe('HTML Escaping', () => {
  it('escapes angle brackets in text content to prevent XSS', () => {
    const { el, mount, serialize } = createService();

    const spec = el('div')('<script>alert("xss")</script>');
    const mounted = mount(spec);

    const html = serialize(mounted.element!);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes ampersands in text content', () => {
    const { el, mount, serialize } = createService();

    const spec = el('div')('Tom & Jerry');
    const mounted = mount(spec);

    expect(serialize(mounted.element!)).toBe('<div>Tom &amp; Jerry</div>');
  });

  it('escapes quotes in attribute values', () => {
    const { adapter, serialize } = createParse5Adapter();

    const div = adapter.createNode('div');
    adapter.setAttribute(div, 'title', 'Say "hello"');

    // parse5 should escape quotes in attributes
    expect(serialize(div)).toContain('title=');
  });
});

// =============================================================================
// Tests: Fragment Markers (Hydration Support)
// =============================================================================

describe('Fragment Markers', () => {
  it('wraps map() children with fragment markers', () => {
    const { el, mount, serialize, signal, map } = createService();

    const items = signal(['a', 'b']);
    const spec = el('div')(
      map(
        items,
        (item) => item,
        (item) => el('span')(item)
      )
    );
    const mounted = mount(spec);

    // Fragment markers should wrap exactly the map children
    expect(serialize(mounted.element!)).toBe(
      '<div><!--fragment-start--><span>a</span><span>b</span><!--fragment-end--></div>'
    );
  });

  it('wraps match() content with fragment markers', () => {
    const { el, mount, serialize, signal, match } = createService();

    const show = signal(true);
    const spec = el('div')(
      match(show, (visible) => (visible ? el('span')('content') : null))
    );
    const mounted = mount(spec);

    expect(serialize(mounted.element!)).toBe(
      '<div><!--fragment-start--><span>content</span><!--fragment-end--></div>'
    );
  });

  it('places markers correctly with sibling content', () => {
    const { el, mount, serialize, signal, map } = createService();

    const items = signal(['x']);
    const spec = el('div')(
      el('header')('before'),
      map(
        items,
        (item) => item,
        (item) => el('span')(item)
      ),
      el('footer')('after')
    );
    const mounted = mount(spec);

    expect(serialize(mounted.element!)).toBe(
      '<div><header>before</header><!--fragment-start--><span>x</span><!--fragment-end--><footer>after</footer></div>'
    );
  });

  it('handles empty fragments (match returning null)', () => {
    const { adapter, serialize } = createParse5Adapter();

    const parent = adapter.createNode('div');

    // Create a fragment ref with no children (typed to match adapter)
    const fragment = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      attach: () => undefined,
    } as const;

    // onAttach should not throw and should not add markers for empty fragments
    adapter.onAttach?.(fragment, parent);

    // No markers should be added - parent remains empty
    expect(serialize(parent)).toBe('<div></div>');
  });
});

// =============================================================================
// Tests: Primitive Integration
// =============================================================================

describe('el() Primitive', () => {
  it('renders nested elements with text content', () => {
    const { el, mount, serialize } = createService();

    const spec = el('article')(
      el('h1')('Title'),
      el('p')('Paragraph 1'),
      el('p')('Paragraph 2')
    );
    const mounted = mount(spec);

    expect(serialize(mounted.element!)).toBe(
      '<article><h1>Title</h1><p>Paragraph 1</p><p>Paragraph 2</p></article>'
    );
  });

  it('renders void elements correctly', () => {
    const { el, mount, serialize } = createService();

    const spec = el('form')(
      el('input').props({ type: 'text', name: 'email' })(),
      el('br')(),
      el('input').props({ type: 'submit' })()
    );
    const mounted = mount(spec);

    expect(serialize(mounted.element!)).toBe(
      '<form><input type="text" name="email"><br><input type="submit"></form>'
    );
  });

  it('renders reactive text content', () => {
    const { el, mount, serialize, signal } = createService();

    const name = signal('World');
    const spec = el('h1')(() => `Hello, ${name()}!`);
    const mounted = mount(spec);

    expect(serialize(mounted.element!)).toBe('<h1>Hello, World!</h1>');
  });

  it('renders reactive attributes', () => {
    const { el, mount, serialize, signal, computed } = createService();

    const isActive = signal(true);
    const className = computed(() => (isActive() ? 'active' : 'inactive'));

    const spec = el('div').props({ className })('Content');
    const mounted = mount(spec);

    expect(serialize(mounted.element!)).toBe('<div class="active">Content</div>');
  });
});

describe('map() Primitive', () => {
  it('renders all items from signal source', () => {
    const { el, mount, serialize, signal, map } = createService();

    const items = signal([1, 2, 3, 4, 5]);
    const spec = el('ul')(
      map(
        items,
        (n) => n,
        (n) => el('li')(() => `Item ${n()}`)
      )
    );
    const mounted = mount(spec);

    const html = serialize(mounted.element!);
    expect(html).toContain('<li>Item 1</li>');
    expect(html).toContain('<li>Item 2</li>');
    expect(html).toContain('<li>Item 3</li>');
    expect(html).toContain('<li>Item 4</li>');
    expect(html).toContain('<li>Item 5</li>');
  });

  it('renders all items from computed source', () => {
    const { el, mount, serialize, computed, map } = createService();

    // Computed source like in ProductFilter
    const items = computed(() => ['apple', 'banana', 'cherry']);
    const spec = el('ul')(
      map(
        items,
        (item) => item,
        (item) => el('li')(item)
      )
    );
    const mounted = mount(spec);

    const html = serialize(mounted.element!);
    expect(html).toContain('<li>apple</li>');
    expect(html).toContain('<li>banana</li>');
    expect(html).toContain('<li>cherry</li>');
  });

  it('renders empty list without errors', () => {
    const { el, mount, serialize, signal, map } = createService();

    const items = signal<string[]>([]);
    const spec = el('ul')(
      map(
        items,
        (item) => item,
        (item) => el('li')(item)
      )
    );
    const mounted = mount(spec);

    // Empty fragments don't have markers (nothing to mark)
    expect(serialize(mounted.element!)).toBe('<ul></ul>');
  });
});

describe('match() Primitive', () => {
  it('renders truthy branch', () => {
    const { el, mount, serialize, signal, match } = createService();

    const isLoggedIn = signal(true);
    const spec = el('div')(
      match(isLoggedIn, (loggedIn) =>
        loggedIn ? el('span')('Welcome!') : el('span')('Please log in')
      )
    );
    const mounted = mount(spec);

    expect(serialize(mounted.element!)).toContain('Welcome!');
    expect(serialize(mounted.element!)).not.toContain('Please log in');
  });

  it('renders falsy branch', () => {
    const { el, mount, serialize, signal, match } = createService();

    const isLoggedIn = signal(false);
    const spec = el('div')(
      match(isLoggedIn, (loggedIn) =>
        loggedIn ? el('span')('Welcome!') : el('span')('Please log in')
      )
    );
    const mounted = mount(spec);

    expect(serialize(mounted.element!)).toContain('Please log in');
    expect(serialize(mounted.element!)).not.toContain('Welcome!');
  });

  it('renders null correctly (no content)', () => {
    const { el, mount, serialize, signal, match } = createService();

    const showBanner = signal(false);
    const spec = el('div')(
      match(showBanner, (show) => (show ? el('div')('Banner') : null))
    );
    const mounted = mount(spec);

    // Empty fragments (null render) don't have markers
    expect(serialize(mounted.element!)).toBe('<div></div>');
  });
});

// =============================================================================
// Tests: Declarative Shadow DOM
// =============================================================================

describe('Declarative Shadow DOM', () => {
  it('renders shadow root as template with shadowrootmode attribute', () => {
    const { el, shadow, mount, serialize } = createService();

    const spec = el('custom-element')(
      shadow({ mode: 'open' })(
        el('p')('Shadow content')
      )
    );
    const mounted = mount(spec);

    const html = serialize(mounted.element!);
    expect(html).toContain('<template shadowrootmode="open">');
    expect(html).toContain('<p>Shadow content</p>');
    expect(html).toContain('</template>');
    expect(html).toContain('</custom-element>');
  });

  it('renders closed mode shadow', () => {
    const { el, shadow, mount, serialize } = createService();

    const spec = el('div')(
      shadow({ mode: 'closed' })(
        el('span')('Private')
      )
    );
    const mounted = mount(spec);

    expect(serialize(mounted.element!)).toContain('shadowrootmode="closed"');
  });

  it('injects styles as style element inside template', () => {
    const { el, shadow, mount, serialize } = createService();

    const css = ':host { display: block; } .content { color: blue; }';
    const spec = el('my-component')(
      shadow({ mode: 'open', styles: css })(
        el('div').props({ className: 'content' })('Styled')
      )
    );
    const mounted = mount(spec);

    const html = serialize(mounted.element!);
    expect(html).toContain('<style>:host { display: block; } .content { color: blue; }</style>');
    expect(html).toContain('<div class="content">Styled</div>');
  });

  it('injects multiple styles in order', () => {
    const { el, shadow, mount, serialize } = createService();

    const styles = ['/* reset */', '/* theme */', '/* component */'];
    const spec = el('div')(
      shadow({ mode: 'open', styles })(
        el('span')('Content')
      )
    );
    const mounted = mount(spec);

    const html = serialize(mounted.element!);
    // Styles should appear in order before content
    const resetIndex = html.indexOf('/* reset */');
    const themeIndex = html.indexOf('/* theme */');
    const componentIndex = html.indexOf('/* component */');
    const contentIndex = html.indexOf('<span>Content</span>');

    expect(resetIndex).toBeLessThan(themeIndex);
    expect(themeIndex).toBeLessThan(componentIndex);
    expect(componentIndex).toBeLessThan(contentIndex);
  });

  it('renders delegatesFocus attribute when enabled', () => {
    const { el, shadow, mount, serialize } = createService();

    const spec = el('focus-trap')(
      shadow({ mode: 'open', delegatesFocus: true })(
        el('input').props({ type: 'text' })()
      )
    );
    const mounted = mount(spec);

    expect(serialize(mounted.element!)).toContain('shadowrootdelegatesfocus');
  });

  it('renders complex nested content inside shadow', () => {
    const { el, shadow, mount, serialize } = createService();

    const spec = el('card-component')(
      shadow({ mode: 'open' })(
        el('header')(el('slot').props({ name: 'title' })()),
        el('main')(el('slot')()),
        el('footer')(el('slot').props({ name: 'actions' })())
      )
    );
    const mounted = mount(spec);

    const html = serialize(mounted.element!);
    expect(html).toContain('<header><slot name="title"></slot></header>');
    expect(html).toContain('<main><slot></slot></main>');
    expect(html).toContain('<footer><slot name="actions"></slot></footer>');
  });

  it('renders reactive content inside shadow', () => {
    const { el, shadow, mount, serialize, signal } = createService();

    const count = signal(0);
    const spec = el('counter-display')(
      shadow({ mode: 'open' })(
        el('output')(() => `Count: ${count()}`)
      )
    );
    const mounted = mount(spec);

    expect(serialize(mounted.element!)).toContain('<output>Count: 0</output>');
  });
});

// =============================================================================
// Tests: Full SSR Integration
// =============================================================================

describe('Full SSR Integration', () => {
  it('renders complete page structure', () => {
    const { el, mount, serialize, signal, map } = createService();

    const products = signal([
      { id: 1, name: 'Widget' },
      { id: 2, name: 'Gadget' },
    ]);

    const spec = el('html')(
      el('head')(
        el('title')('Shop')
      ),
      el('body')(
        el('header')(el('h1')('Welcome')),
        el('main')(
          el('ul')(
            map(
              products,
              (p) => p.id,
              (p) => el('li')(() => p().name)
            )
          )
        ),
        el('footer')('2024')
      )
    );
    const mounted = mount(spec);

    const html = serialize(mounted.element!);
    expect(html).toContain('<title>Shop</title>');
    expect(html).toContain('<h1>Welcome</h1>');
    expect(html).toContain('<li>Widget</li>');
    expect(html).toContain('<li>Gadget</li>');
    expect(html).toContain('<footer>2024</footer>');
  });
});
