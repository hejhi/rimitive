import { describe, it, expect } from 'vitest';
import { createLinkedomRenderer } from './linkedom';

describe('linkedom renderer', () => {
  it('should create elements', () => {
    const renderer = createLinkedomRenderer();

    const div = renderer.createElement('div');
    expect(div.outerHTML).toBe('<div></div>');
  });

  it('should create text nodes', () => {
    const renderer = createLinkedomRenderer();

    const text = renderer.createTextNode('Hello World');
    expect(text.textContent).toBe('Hello World');
  });

  it('should append children', () => {
    const renderer = createLinkedomRenderer();

    const div = renderer.createElement('div');
    const text = renderer.createTextNode('Hello');
    renderer.appendChild(div, text);

    expect(div.outerHTML).toBe('<div>Hello</div>');
  });

  it('should set attributes', () => {
    const renderer = createLinkedomRenderer();

    const input = renderer.createElement('input');
    renderer.setAttribute(input, 'type', 'text');
    renderer.setAttribute(input, 'placeholder', 'Enter name');

    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('placeholder')).toBe('Enter name');
  });

  it('should skip event handler attributes', () => {
    const renderer = createLinkedomRenderer();

    const button = renderer.createElement('button');
    renderer.setAttribute(button, 'onclick', () => {});
    renderer.setAttribute(button, 'className', 'btn');

    expect(button.hasAttribute('onclick')).toBe(false);
    expect(button.getAttribute('class')).toBe('btn');  // className is mapped to class
  });

  it('should escape HTML in text content', () => {
    const renderer = createLinkedomRenderer();

    const div = renderer.createElement('div');
    const text = renderer.createTextNode('<script>alert("xss")</script>');
    renderer.appendChild(div, text);

    expect(div.textContent).toBe('<script>alert("xss")</script>');
    expect(div.outerHTML).toBe('<div>&lt;script&gt;alert("xss")&lt;/script&gt;</div>');
  });

  it('should handle nested elements', () => {
    const renderer = createLinkedomRenderer();

    const div = renderer.createElement('div');
    const h1 = renderer.createElement('h1');
    const h1Text = renderer.createTextNode('Title');
    const p = renderer.createElement('p');
    const pText = renderer.createTextNode('Paragraph');

    renderer.appendChild(h1, h1Text);
    renderer.appendChild(p, pText);
    renderer.appendChild(div, h1);
    renderer.appendChild(div, p);

    expect(div.outerHTML).toBe('<div><h1>Title</h1><p>Paragraph</p></div>');
  });

  it('should handle void elements', () => {
    const renderer = createLinkedomRenderer();

    const img = renderer.createElement('img');
    renderer.setAttribute(img, 'src', 'photo.jpg');
    renderer.setAttribute(img, 'alt', 'Photo');

    // linkedom handles void elements automatically
    const html = img.outerHTML;
    expect(html).toContain('src="photo.jpg"');
    expect(html).toContain('alt="Photo"');
    expect(html).toMatch(/^<img[^>]*>$/); // No closing tag
  });

  it('should update text node content', () => {
    const renderer = createLinkedomRenderer();

    const text = renderer.createTextNode('Initial');
    expect(text.textContent).toBe('Initial');

    renderer.updateTextNode(text, 'Updated');
    expect(text.textContent).toBe('Updated');
  });

  it('should remove children', () => {
    const renderer = createLinkedomRenderer();

    const div = renderer.createElement('div');
    const span = renderer.createElement('span');
    const text = renderer.createTextNode('Hello');

    renderer.appendChild(span, text);
    renderer.appendChild(div, span);
    expect(div.outerHTML).toBe('<div><span>Hello</span></div>');

    renderer.removeChild(div, span);
    expect(div.outerHTML).toBe('<div></div>');
  });

  it('should insert before reference node', () => {
    const renderer = createLinkedomRenderer();

    const div = renderer.createElement('div');
    const span1 = renderer.createElement('span');
    const span2 = renderer.createElement('span');
    const text1 = renderer.createTextNode('First');
    const text2 = renderer.createTextNode('Second');

    renderer.appendChild(span1, text1);
    renderer.appendChild(span2, text2);
    renderer.appendChild(div, span2); // Add second first

    renderer.insertBefore(div, span1, span2); // Insert first before second

    expect(div.outerHTML).toBe('<div><span>First</span><span>Second</span></div>');
  });

  it('should report connected status', () => {
    const renderer = createLinkedomRenderer();

    const div = renderer.createElement('div');

    // linkedom elements are not connected until appended to document
    expect(renderer.isConnected(div)).toBe(false);
  });
});
