import { describe, it } from 'vitest';
import { createDOMRenderer } from './renderers/dom';
import { createApi } from './presets/core';

describe('El - Reactive Tag Props Types', () => {
  it('should type props as intersection for union of tags', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);

    // When tags are 'button' | 'input', props should be properties common to both
    const tagType = api.signal<'button' | 'input'>('button');

    // These props exist on both button and input - should work
    api.el(tagType, {
      className: 'interactive',
      disabled: true,
      type: 'button', // Both have 'type' property
    })('Text');

    // Common properties can be reactive
    const isDisabled = api.signal(false);
    api.el(tagType, {
      className: 'dynamic',
      disabled: isDisabled,
    })('Text');
  });

  it('should type single tag props correctly', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);

    const tagType = api.signal<'input'>('input');

    // Input-specific props should be available
    api.el(tagType, {
      type: 'text',
      value: 'hello',
      placeholder: 'Enter text',
    })();

    // Reactive input props
    const inputValue = api.signal('');
    api.el(tagType, {
      value: inputValue,
      placeholder: 'Type something',
    })();
  });

  it('should properly type common props for div and span', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);

    const tagType = api.signal<'div' | 'span'>('div');

    // These props should work on both
    api.el(tagType, {
      className: 'text',
      id: 'myElement',
      title: 'tooltip',
    })('Content');

    // Reactive common props
    const dynamicClass = api.signal('initial');
    api.el(tagType, {
      className: dynamicClass,
      title: 'Dynamic title',
    })('Content');
  });

  it('should handle nullable tags with props', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);

    const show = api.signal(true);
    // Use api.signal for the tag type instead of computed
    const tagType = api.signal<'button' | null>('button');

    // Props should be typed for button (null is filtered out)
    api.el(tagType, {
      type: 'button',
      disabled: false,
    })('Click me');

    // Toggle visibility
    show(false);
    tagType(null);
  });

  it('should properly type anchor and button union', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);

    const tagType = api.signal<'a' | 'button'>('a');

    // Only common properties between a and button are allowed
    api.el(tagType, {
      className: 'clickable',
      title: 'Click this',
    })('Click');

    // With reactive values
    const dynamicClass = api.signal('link');
    api.el(tagType, {
      className: dynamicClass,
    })('Click');
  });
});
