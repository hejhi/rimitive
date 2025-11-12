import { describe, it, expectTypeOf } from 'vitest';
import { createDOMRenderer } from './renderers/dom';
import { createApi } from './presets/core';

describe('El - Reactive Tag Types', () => {
  it('should type lifecycle callback with union of element types', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);

    const tagType = api.signal<'h1' | 'p'>('h1');

    // This should type the callback parameter as HTMLHeadingElement | HTMLParagraphElement
    api.el(tagType, { className: 'text' })('Content')((el) => {
      // Type assertion to verify the type is correct
      expectTypeOf(el).toMatchTypeOf<HTMLHeadingElement | HTMLParagraphElement>();

      // These properties exist on both types
      expectTypeOf(el.textContent).toMatchTypeOf<string | null>();
      expectTypeOf(el.className).toMatchTypeOf<string>();

      // This property only exists on HTMLHeadingElement, not HTMLParagraphElement
      // So we need to check the type at runtime
      if ('align' in el) {
        expectTypeOf(el).toMatchTypeOf<HTMLHeadingElement>();
      }
    });
  });

  it('should type single reactive tag correctly', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);

    const tagType = api.signal<'button'>('button');

    api.el(tagType)('Click me')((el) => {
      // Should be typed as HTMLButtonElement
      expectTypeOf(el).toMatchTypeOf<HTMLButtonElement>();
      expectTypeOf(el.type).toMatchTypeOf<string>();
      expectTypeOf(el.disabled).toMatchTypeOf<boolean>();
    });
  });

  it('should type nullable reactive tag correctly', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);

    const tagType = api.signal<'div' | null>('div');

    api.el(tagType)('Content')((el) => {
      // Should be typed as HTMLDivElement (null is filtered out for lifecycle)
      expectTypeOf(el).toMatchTypeOf<HTMLDivElement>();
      expectTypeOf(el.innerHTML).toMatchTypeOf<string>();
    });
  });

  it('should handle complex union types', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);

    const tagType = api.signal<'a' | 'button' | 'input'>('a');

    api.el(tagType, { className: 'interactive' })('Text')((el) => {
      // Should be typed as union of all three element types
      expectTypeOf(el).toMatchTypeOf<HTMLAnchorElement | HTMLButtonElement | HTMLInputElement>();

      // Common properties
      expectTypeOf(el.className).toMatchTypeOf<string>();

      // Type-specific properties require runtime checks
      if ('href' in el) {
        expectTypeOf(el).toMatchTypeOf<HTMLAnchorElement>();
        expectTypeOf(el.href).toMatchTypeOf<string>();
      }

      if ('type' in el && el instanceof HTMLButtonElement) {
        expectTypeOf(el.type).toMatchTypeOf<string>();
      }
    });
  });

  it('static tags should still be precisely typed', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);

    // Static tag should give precise type, not a union
    api.el('section', { className: 'container' })('Content')((el) => {
      expectTypeOf(el).toMatchTypeOf<HTMLElement>();
    });
  });
});
