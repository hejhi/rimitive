/**
 * Type-level tests for SVG attribute types.
 *
 * These tests verify that SVG elements accept string/number props
 * instead of SVGAnimatedLength/SVGAnimatedRect DOM property types.
 *
 * @see https://github.com/hejhi/rimitive/issues/41
 */
import { describe, it, expect } from 'vitest';
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
import { createElModule } from '../el';
import { createDOMAdapter } from './dom';

describe('SVG attribute types (issue #41)', () => {
  const adapter = createDOMAdapter();
  const svc = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    createElModule(adapter)
  );
  const { el } = svc;

  it('should accept string values for svg element props', () => {
    // This should compile without type errors
    const svg = el('svg').props({
      viewBox: '0 0 16 16',
      width: '16',
      height: '16',
      xmlns: 'http://www.w3.org/2000/svg',
    })();

    expect(svg).toBeDefined();
  });

  it('should accept number values for svg element props', () => {
    // Numbers should also work
    const svg = el('svg').props({
      width: 16,
      height: 16,
    })();

    expect(svg).toBeDefined();
  });

  it('should accept string values for circle element props', () => {
    // cx, cy, r should accept strings (not SVGAnimatedLength)
    const circle = el('circle').props({
      cx: '8',
      cy: '8',
      r: '6',
      fill: 'currentColor',
    })();

    expect(circle).toBeDefined();
  });

  it('should accept number values for circle element props', () => {
    const circle = el('circle').props({
      cx: 8,
      cy: 8,
      r: 6,
    })();

    expect(circle).toBeDefined();
  });

  it('should accept string values for rect element props', () => {
    const rect = el('rect').props({
      x: '10',
      y: '10',
      width: '100',
      height: '50',
      rx: '5',
      ry: '5',
    })();

    expect(rect).toBeDefined();
  });

  it('should accept string values for line element props', () => {
    const line = el('line').props({
      x1: '0',
      y1: '0',
      x2: '100',
      y2: '100',
      stroke: 'black',
      strokeWidth: '2',
    })();

    expect(line).toBeDefined();
  });

  it('should accept string values for ellipse element props', () => {
    const ellipse = el('ellipse').props({
      cx: '50',
      cy: '25',
      rx: '50',
      ry: '25',
    })();

    expect(ellipse).toBeDefined();
  });

  it('should accept string values for path element props', () => {
    const path = el('path').props({
      d: 'M 10 10 L 90 90',
      fill: 'none',
      stroke: 'black',
      strokeWidth: '2',
    })();

    expect(path).toBeDefined();
  });

  it('should accept string values for polygon and polyline props', () => {
    const polygon = el('polygon').props({
      points: '100,10 40,198 190,78 10,78 160,198',
      fill: 'lime',
    })();

    const polyline = el('polyline').props({
      points: '0,40 40,40 40,80 80,80 80,120 120,120',
      fill: 'none',
      stroke: 'blue',
    })();

    expect(polygon).toBeDefined();
    expect(polyline).toBeDefined();
  });

  it('should accept string values for text element props', () => {
    const text = el('text').props({
      x: '50',
      y: '50',
      dx: '5',
      dy: '5',
      textAnchor: 'middle',
      fontFamily: 'sans-serif',
      fontSize: '16',
    })();

    expect(text).toBeDefined();
  });

  it('should accept string values for gradient elements', () => {
    const linearGradient = el('linearGradient').props({
      x1: '0%',
      y1: '0%',
      x2: '100%',
      y2: '0%',
      gradientUnits: 'objectBoundingBox',
    })();

    const radialGradient = el('radialGradient').props({
      cx: '50%',
      cy: '50%',
      r: '50%',
      fx: '50%',
      fy: '50%',
    })();

    expect(linearGradient).toBeDefined();
    expect(radialGradient).toBeDefined();
  });

  it('should accept string values for filter primitives', () => {
    const feGaussianBlur = el('feGaussianBlur').props({
      in: 'SourceGraphic',
      stdDeviation: '5',
    })();

    const feOffset = el('feOffset').props({
      dx: '5',
      dy: '5',
      result: 'offsetResult',
    })();

    expect(feGaussianBlur).toBeDefined();
    expect(feOffset).toBeDefined();
  });

  it('should accept string values for use element href', () => {
    const use = el('use').props({
      href: '#mySymbol',
      x: '10',
      y: '10',
    })();

    expect(use).toBeDefined();
  });

  it('should accept string values for image element', () => {
    const image = el('image').props({
      href: 'image.png',
      x: '0',
      y: '0',
      width: '100',
      height: '100',
      preserveAspectRatio: 'xMidYMid meet',
    })();

    expect(image).toBeDefined();
  });

  it('should build complete SVG icon without type errors', () => {
    // This is the example from the issue - should compile without errors
    const svg = el('svg');
    const circle = el('circle');

    const icon = svg.props({
      viewBox: '0 0 16 16',
      width: '16',
      height: '16',
    })(
      circle.props({
        cx: '8',
        cy: '8',
        r: '6',
        fill: 'currentColor',
      })()
    );

    expect(icon).toBeDefined();
  });

  it('should accept presentation attributes', () => {
    const rect = el('rect').props({
      fill: '#ff0000',
      fillOpacity: 0.5,
      stroke: 'black',
      strokeWidth: 2,
      strokeDasharray: '5,5',
      transform: 'rotate(45)',
      opacity: 0.8,
    })();

    expect(rect).toBeDefined();
  });
});
