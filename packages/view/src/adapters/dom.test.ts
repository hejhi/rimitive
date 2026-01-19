import { describe, it, expect } from 'vitest';
import { createDOMAdapter } from './dom';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HTML_NS = 'http://www.w3.org/1999/xhtml';

// Helper to cast Node to Element for tests
const asElement = (node: Node): Element => node as Element;

describe('DOM adapter SVG support', () => {
  describe('createNode', () => {
    it('creates SVG element with SVG namespace', () => {
      const adapter = createDOMAdapter();
      const svg = asElement(adapter.createNode('svg', {}));

      expect(svg).toBeInstanceOf(SVGSVGElement);
      expect(svg.namespaceURI).toBe(SVG_NS);
    });

    it('creates SVG element without parentContext (root case)', () => {
      const adapter = createDOMAdapter();
      const svg = asElement(adapter.createNode('svg', {}, undefined));

      expect(svg).toBeInstanceOf(SVGSVGElement);
      expect(svg.namespaceURI).toBe(SVG_NS);
    });

    it('creates HTML div element', () => {
      const adapter = createDOMAdapter();
      const div = asElement(adapter.createNode('div', {}));

      expect(div).toBeInstanceOf(HTMLDivElement);
      expect(div.namespaceURI).toBe(HTML_NS);
    });

    it('creates text nodes', () => {
      const adapter = createDOMAdapter();
      const text = adapter.createNode('text', { value: 'Hello' });

      expect(text.nodeType).toBe(3);
      expect(text.textContent).toBe('Hello');
    });
  });

  describe('SVG children inherit namespace', () => {
    it('creates SVG children in SVG namespace', () => {
      const adapter = createDOMAdapter();
      const svg = adapter.createNode('svg', {});
      const g = asElement(adapter.createNode('g', {}, { adapter, element: svg }));

      expect(g.namespaceURI).toBe(SVG_NS);
    });

    it('creates nested SVG elements (svg > g > path)', () => {
      const adapter = createDOMAdapter();
      const svg = asElement(adapter.createNode('svg', {}));
      const g = asElement(adapter.createNode('g', {}, { adapter, element: svg }));
      const path = asElement(adapter.createNode('path', {}, { adapter, element: g }));

      expect(svg.namespaceURI).toBe(SVG_NS);
      expect(g.namespaceURI).toBe(SVG_NS);
      expect(path.namespaceURI).toBe(SVG_NS);
    });

    it('creates SVG rect element', () => {
      const adapter = createDOMAdapter();
      const svg = adapter.createNode('svg', {});
      const rect = asElement(adapter.createNode('rect', {}, { adapter, element: svg }));

      expect(rect.namespaceURI).toBe(SVG_NS);
    });

    it('creates SVG circle element', () => {
      const adapter = createDOMAdapter();
      const svg = adapter.createNode('svg', {});
      const circle = asElement(adapter.createNode('circle', {}, { adapter, element: svg }));

      expect(circle.namespaceURI).toBe(SVG_NS);
    });
  });

  describe('foreignObject children use HTML namespace', () => {
    it('creates HTML div inside foreignObject', () => {
      const adapter = createDOMAdapter();
      const svg = asElement(adapter.createNode('svg', {}));
      const foreignObject = asElement(adapter.createNode('foreignObject', {}, {
        adapter,
        element: svg,
      }));
      const div = asElement(adapter.createNode('div', {}, {
        adapter,
        element: foreignObject,
      }));

      expect(svg.namespaceURI).toBe(SVG_NS);
      expect(foreignObject.namespaceURI).toBe(SVG_NS);
      expect(div.namespaceURI).toBe(HTML_NS);
    });

    it('creates HTML span inside foreignObject', () => {
      const adapter = createDOMAdapter();
      const svg = adapter.createNode('svg', {});
      const foreignObject = adapter.createNode('foreignObject', {}, {
        adapter,
        element: svg,
      });
      const span = asElement(adapter.createNode('span', {}, {
        adapter,
        element: foreignObject,
      }));

      expect(span.namespaceURI).toBe(HTML_NS);
    });

    it('creates nested HTML elements inside foreignObject', () => {
      const adapter = createDOMAdapter();
      const svg = adapter.createNode('svg', {});
      const foreignObject = adapter.createNode('foreignObject', {}, {
        adapter,
        element: svg,
      });
      const div = asElement(adapter.createNode('div', {}, {
        adapter,
        element: foreignObject,
      }));
      const p = asElement(adapter.createNode('p', {}, { adapter, element: div }));

      expect(div.namespaceURI).toBe(HTML_NS);
      expect(p.namespaceURI).toBe(HTML_NS);
    });
  });

  describe('nested SVG after foreignObject', () => {
    it('creates SVG inside HTML div inside foreignObject', () => {
      const adapter = createDOMAdapter();
      const outerSvg = asElement(adapter.createNode('svg', {}));
      const foreignObject = asElement(adapter.createNode('foreignObject', {}, {
        adapter,
        element: outerSvg,
      }));
      const div = asElement(adapter.createNode('div', {}, {
        adapter,
        element: foreignObject,
      }));
      const innerSvg = asElement(adapter.createNode('svg', {}, {
        adapter,
        element: div,
      }));
      const path = asElement(adapter.createNode('path', {}, {
        adapter,
        element: innerSvg,
      }));

      expect(outerSvg.namespaceURI).toBe(SVG_NS);
      expect(foreignObject.namespaceURI).toBe(SVG_NS);
      expect(div.namespaceURI).toBe(HTML_NS);
      expect(innerSvg.namespaceURI).toBe(SVG_NS);
      expect(path.namespaceURI).toBe(SVG_NS);
    });

    it('handles complex SVG/HTML nesting', () => {
      const adapter = createDOMAdapter();
      const svg1 = asElement(adapter.createNode('svg', {}));
      const g = asElement(adapter.createNode('g', {}, { adapter, element: svg1 }));
      const foreignObject = asElement(adapter.createNode('foreignObject', {}, {
        adapter,
        element: g,
      }));
      const div = asElement(adapter.createNode('div', {}, {
        adapter,
        element: foreignObject,
      }));
      const svg2 = asElement(adapter.createNode('svg', {}, {
        adapter,
        element: div,
      }));
      const circle = asElement(adapter.createNode('circle', {}, {
        adapter,
        element: svg2,
      }));

      expect(svg1.namespaceURI).toBe(SVG_NS);
      expect(g.namespaceURI).toBe(SVG_NS);
      expect(foreignObject.namespaceURI).toBe(SVG_NS);
      expect(div.namespaceURI).toBe(HTML_NS);
      expect(svg2.namespaceURI).toBe(SVG_NS);
      expect(circle.namespaceURI).toBe(SVG_NS);
    });
  });

  describe('setProperty', () => {
    describe('SVG attribute setting', () => {
      it('preserves viewBox case', () => {
        const adapter = createDOMAdapter();
        const svg = asElement(adapter.createNode('svg', {}));

        adapter.setProperty(svg, 'viewBox', '0 0 100 100');

        expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
      });

      it('preserves preserveAspectRatio case', () => {
        const adapter = createDOMAdapter();
        const svg = asElement(adapter.createNode('svg', {}));

        adapter.setProperty(svg, 'preserveAspectRatio', 'xMidYMid meet');

        expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
      });

      it('sets fill attribute', () => {
        const adapter = createDOMAdapter();
        const svg = adapter.createNode('svg', {});
        const path = asElement(adapter.createNode('path', {}, { adapter, element: svg }));

        adapter.setProperty(path, 'fill', 'red');

        expect(path.getAttribute('fill')).toBe('red');
      });

      it('sets stroke attribute', () => {
        const adapter = createDOMAdapter();
        const svg = adapter.createNode('svg', {});
        const path = asElement(adapter.createNode('path', {}, { adapter, element: svg }));

        adapter.setProperty(path, 'stroke', 'blue');

        expect(path.getAttribute('stroke')).toBe('blue');
      });

      it('sets d attribute on path', () => {
        const adapter = createDOMAdapter();
        const svg = adapter.createNode('svg', {});
        const path = asElement(adapter.createNode('path', {}, { adapter, element: svg }));

        adapter.setProperty(path, 'd', 'M 10 10 L 90 90');

        expect(path.getAttribute('d')).toBe('M 10 10 L 90 90');
      });

      it('sets stroke-width attribute (hyphenated)', () => {
        const adapter = createDOMAdapter();
        const svg = adapter.createNode('svg', {});
        const path = asElement(adapter.createNode('path', {}, { adapter, element: svg }));

        adapter.setProperty(path, 'stroke-width', '2');

        expect(path.getAttribute('stroke-width')).toBe('2');
      });

      it('removes SVG attribute when value is null', () => {
        const adapter = createDOMAdapter();
        const svg = asElement(adapter.createNode('svg', {}));
        adapter.setProperty(svg, 'viewBox', '0 0 100 100');

        adapter.setProperty(svg, 'viewBox', null);

        expect(svg.hasAttribute('viewBox')).toBe(false);
      });

      it('removes SVG attribute when value is undefined', () => {
        const adapter = createDOMAdapter();
        const svg = asElement(adapter.createNode('svg', {}));
        adapter.setProperty(svg, 'fill', 'red');

        adapter.setProperty(svg, 'fill', undefined);

        expect(svg.hasAttribute('fill')).toBe(false);
      });
    });

    describe('event handlers on SVG elements', () => {
      it('uses property assignment for onclick', () => {
        const adapter = createDOMAdapter();
        const svg = asElement(adapter.createNode('svg', {}));
        const handler = () => {};

        adapter.setProperty(svg, 'onclick', handler);

        expect((svg as Element & { onclick: unknown }).onclick).toBe(handler);
        expect(svg.hasAttribute('onclick')).toBe(false);
      });

      it('uses property assignment for onmouseenter', () => {
        const adapter = createDOMAdapter();
        const svg = adapter.createNode('svg', {});
        const path = asElement(adapter.createNode('path', {}, { adapter, element: svg }));
        const handler = () => {};

        adapter.setProperty(path, 'onmouseenter', handler);

        expect((path as Element & { onmouseenter: unknown }).onmouseenter).toBe(
          handler
        );
        expect(path.hasAttribute('onmouseenter')).toBe(false);
      });

      it('uses property assignment for onmouseleave', () => {
        const adapter = createDOMAdapter();
        const svg = adapter.createNode('svg', {});
        const circle = asElement(adapter.createNode('circle', {}, {
          adapter,
          element: svg,
        }));
        const handler = () => {};

        adapter.setProperty(circle, 'onmouseleave', handler);

        expect(
          (circle as Element & { onmouseleave: unknown }).onmouseleave
        ).toBe(handler);
        expect(circle.hasAttribute('onmouseleave')).toBe(false);
      });
    });

    describe('HTML element properties', () => {
      it('uses property assignment for non-hyphenated HTML properties', () => {
        const adapter = createDOMAdapter();
        const div = adapter.createNode('div', {});

        adapter.setProperty(div, 'className', 'test');

        expect((div as HTMLElement).className).toBe('test');
      });

      it('uses setAttribute for hyphenated HTML attributes', () => {
        const adapter = createDOMAdapter();
        const div = asElement(adapter.createNode('div', {}));

        adapter.setProperty(div, 'data-test', 'value');

        expect(div.getAttribute('data-test')).toBe('value');
      });

      it('uses setAttribute for aria attributes', () => {
        const adapter = createDOMAdapter();
        const button = asElement(adapter.createNode('button', {}));

        adapter.setProperty(button, 'aria-label', 'Close');

        expect(button.getAttribute('aria-label')).toBe('Close');
      });
    });

    describe('text node properties', () => {
      it('sets text content via value property', () => {
        const adapter = createDOMAdapter();
        const text = adapter.createNode('text', { value: 'Initial' });

        adapter.setProperty(text, 'value', 'Updated');

        expect(text.textContent).toBe('Updated');
      });

      it('handles null value on text node', () => {
        const adapter = createDOMAdapter();
        const text = adapter.createNode('text', { value: 'Hello' });

        adapter.setProperty(text, 'value', null);

        expect(text.textContent).toBe('');
      });

      it('ignores non-value properties on text nodes', () => {
        const adapter = createDOMAdapter();
        const text = adapter.createNode('text', { value: 'Hello' });

        adapter.setProperty(text, 'className', 'test');

        expect(text.textContent).toBe('Hello');
      });
    });
  });

  describe('integration scenarios', () => {
    it('creates complete SVG with attributes', () => {
      const adapter = createDOMAdapter();
      const svg = asElement(adapter.createNode('svg', {}));

      adapter.setProperty(svg, 'viewBox', '0 0 100 100');
      adapter.setProperty(svg, 'width', '100');
      adapter.setProperty(svg, 'height', '100');

      const path = asElement(adapter.createNode('path', {}, { adapter, element: svg }));
      adapter.setProperty(path, 'd', 'M 10 10 L 90 90');
      adapter.setProperty(path, 'fill', 'none');
      adapter.setProperty(path, 'stroke', 'black');
      adapter.setProperty(path, 'stroke-width', '2');

      adapter.appendChild(svg, path);

      expect(svg.namespaceURI).toBe(SVG_NS);
      expect(path.namespaceURI).toBe(SVG_NS);
      expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
      expect(path.getAttribute('d')).toBe('M 10 10 L 90 90');
      expect(path.getAttribute('stroke-width')).toBe('2');
      expect(svg.children).toHaveLength(1);
    });

    it('creates SVG with foreignObject containing HTML', () => {
      const adapter = createDOMAdapter();
      const svg = asElement(adapter.createNode('svg', {}));
      const foreignObject = asElement(adapter.createNode('foreignObject', {}, {
        adapter,
        element: svg,
      }));
      const div = asElement(adapter.createNode('div', {}, {
        adapter,
        element: foreignObject,
      }));

      adapter.setProperty(svg, 'viewBox', '0 0 200 200');
      adapter.setProperty(foreignObject, 'x', '10');
      adapter.setProperty(foreignObject, 'y', '10');
      adapter.setProperty(foreignObject, 'width', '180');
      adapter.setProperty(foreignObject, 'height', '180');
      adapter.setProperty(div, 'className', 'content');

      adapter.appendChild(foreignObject, div);
      adapter.appendChild(svg, foreignObject);

      expect(svg.namespaceURI).toBe(SVG_NS);
      expect(foreignObject.namespaceURI).toBe(SVG_NS);
      expect(div.namespaceURI).toBe(HTML_NS);
      expect((div as HTMLElement).className).toBe('content');
      expect(foreignObject.getAttribute('x')).toBe('10');
    });

    it('creates complex nested SVG/HTML structure', () => {
      const adapter = createDOMAdapter();

      const outerSvg = asElement(adapter.createNode('svg', {}));
      adapter.setProperty(outerSvg, 'viewBox', '0 0 300 300');

      const g = asElement(adapter.createNode('g', {}, { adapter, element: outerSvg }));
      adapter.setProperty(g, 'transform', 'translate(50, 50)');

      const rect = asElement(adapter.createNode('rect', {}, { adapter, element: g }));
      adapter.setProperty(rect, 'width', '200');
      adapter.setProperty(rect, 'height', '200');
      adapter.setProperty(rect, 'fill', 'lightgray');

      const foreignObject = asElement(adapter.createNode('foreignObject', {}, {
        adapter,
        element: g,
      }));
      adapter.setProperty(foreignObject, 'x', '10');
      adapter.setProperty(foreignObject, 'y', '10');
      adapter.setProperty(foreignObject, 'width', '180');
      adapter.setProperty(foreignObject, 'height', '180');

      const div = asElement(adapter.createNode('div', {}, {
        adapter,
        element: foreignObject,
      }));
      adapter.setProperty(div, 'className', 'html-content');

      const innerSvg = asElement(adapter.createNode('svg', {}, {
        adapter,
        element: div,
      }));
      adapter.setProperty(innerSvg, 'viewBox', '0 0 50 50');

      const circle = asElement(adapter.createNode('circle', {}, {
        adapter,
        element: innerSvg,
      }));
      adapter.setProperty(circle, 'cx', '25');
      adapter.setProperty(circle, 'cy', '25');
      adapter.setProperty(circle, 'r', '20');
      adapter.setProperty(circle, 'fill', 'blue');

      adapter.appendChild(innerSvg, circle);
      adapter.appendChild(div, innerSvg);
      adapter.appendChild(foreignObject, div);
      adapter.appendChild(g, rect);
      adapter.appendChild(g, foreignObject);
      adapter.appendChild(outerSvg, g);

      expect(outerSvg.namespaceURI).toBe(SVG_NS);
      expect(g.namespaceURI).toBe(SVG_NS);
      expect(rect.namespaceURI).toBe(SVG_NS);
      expect(foreignObject.namespaceURI).toBe(SVG_NS);
      expect(div.namespaceURI).toBe(HTML_NS);
      expect(innerSvg.namespaceURI).toBe(SVG_NS);
      expect(circle.namespaceURI).toBe(SVG_NS);

      expect(g.getAttribute('transform')).toBe('translate(50, 50)');
      expect((div as HTMLElement).className).toBe('html-content');
      expect(circle.getAttribute('fill')).toBe('blue');
    });
  });
});
