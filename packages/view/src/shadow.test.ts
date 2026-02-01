import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
import { createDOMAdapter } from './adapters/dom';
import { createElModule } from './el';
import { createShadowModule } from './shadow';
import { MountModule } from './deps/mount';

describe('shadow', () => {
  const adapter = createDOMAdapter();

  const createService = () =>
    compose(
      SignalModule,
      ComputedModule,
      EffectModule,
      createElModule(adapter),
      createShadowModule(adapter),
      MountModule
    );

  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    return () => {
      container.remove();
    };
  });

  it('should create a shadow root on parent element', () => {
    const { el, shadow, mount } = createService();

    const spec = el('div').props({ className: 'host' })(
      shadow({ mode: 'open' })(el('p')('Inside shadow'))
    );

    const mounted = mount(spec);
    container.appendChild(mounted.element!);

    const host = container.querySelector('.host');
    expect(host).toBeTruthy();
    expect(host!.shadowRoot).toBeTruthy();
    expect(host!.shadowRoot!.querySelector('p')?.textContent).toBe(
      'Inside shadow'
    );
  });

  it('should inject styles into shadow root', () => {
    const { el, shadow, mount } = createService();

    const css = '.test { color: red; }';
    const spec = el('div')(
      shadow({ mode: 'open', styles: css })(el('span').props({ className: 'test' })('Styled'))
    );

    const mounted = mount(spec);
    container.appendChild(mounted.element!);

    const host = mounted.element as HTMLElement;
    const styleEl = host.shadowRoot!.querySelector('style');
    expect(styleEl).toBeTruthy();
    expect(styleEl!.textContent).toBe(css);
  });

  it('should support multiple style strings', () => {
    const { el, shadow, mount } = createService();

    const styles = ['.a { color: red; }', '.b { color: blue; }'];
    const spec = el('div')(shadow({ mode: 'open', styles })());

    const mounted = mount(spec);
    container.appendChild(mounted.element!);

    const host = mounted.element as HTMLElement;
    const styleEls = host.shadowRoot!.querySelectorAll('style');
    expect(styleEls.length).toBe(2);
  });

  it('should call ref callback with shadow root', () => {
    const { el, shadow, mount } = createService();

    let capturedRoot: ShadowRoot | null = null;
    const spec = el('div')(
      shadow({ mode: 'open' }).ref((root) => {
        capturedRoot = root;
      })()
    );

    const mounted = mount(spec);
    container.appendChild(mounted.element!);

    expect(capturedRoot).toBeTruthy();
    expect(capturedRoot).toBeInstanceOf(ShadowRoot);
  });

  it('should register cleanup from ref callback', () => {
    const { el, shadow, mount } = createService();

    let capturedRoot: ShadowRoot | null = null;
    const cleanup = vi.fn();
    const spec = el('div')(
      shadow({ mode: 'open' }).ref((root) => {
        capturedRoot = root;
        return cleanup;
      })()
    );

    const mounted = mount(spec);
    container.appendChild(mounted.element!);

    // Cleanup is registered but not yet called
    expect(capturedRoot).toBeTruthy();
    expect(cleanup).not.toHaveBeenCalled();

    // Note: cleanup is called when the scope is disposed, which happens
    // through rimitive's scope system, not just mounted.dispose()
  });

  it('should support closed mode', () => {
    const { el, shadow, mount } = createService();

    const spec = el('div')(shadow({ mode: 'closed' })(el('p')('Hidden')));

    const mounted = mount(spec);
    container.appendChild(mounted.element!);

    const host = mounted.element as HTMLElement;
    // Closed shadow roots are not accessible via element.shadowRoot
    expect(host.shadowRoot).toBeNull();
  });

  it('should render reactive children inside shadow', () => {
    const { el, shadow, mount, signal } = createService();

    const count = signal(0);
    const spec = el('div')(
      shadow({ mode: 'open' })(el('span')(() => `Count: ${count()}`))
    );

    const mounted = mount(spec);
    container.appendChild(mounted.element!);

    const host = mounted.element as HTMLElement;
    expect(host.shadowRoot!.querySelector('span')?.textContent).toBe('Count: 0');

    count(5);
    expect(host.shadowRoot!.querySelector('span')?.textContent).toBe('Count: 5');
  });

  it('should support .props() to update options', () => {
    const { el, shadow, mount } = createService();

    const css = '.updated { color: green; }';
    const spec = el('div')(
      shadow({ mode: 'open' }).props({ styles: css })(el('p')('Content'))
    );

    const mounted = mount(spec);
    container.appendChild(mounted.element!);

    const host = mounted.element as HTMLElement;
    expect(host.shadowRoot!.querySelector('style')?.textContent).toBe(css);
  });

  it('should allow imperative setup in ref', () => {
    const { el, shadow, mount } = createService();

    let imperativeElement: HTMLDivElement | null = null;

    const spec = el('div')(
      shadow({ mode: 'open' }).ref((shadowRoot) => {
        // Imperative DOM manipulation
        imperativeElement = document.createElement('div');
        imperativeElement.textContent = 'Imperative content';
        imperativeElement.className = 'imperative';
        shadowRoot.appendChild(imperativeElement);
      })(
        // Declarative children also work
        el('p')('Declarative content')
      )
    );

    const mounted = mount(spec);
    container.appendChild(mounted.element!);

    const host = mounted.element as HTMLElement;
    // Both imperative and declarative content should be present
    expect(host.shadowRoot!.querySelector('.imperative')?.textContent).toBe(
      'Imperative content'
    );
    expect(host.shadowRoot!.querySelector('p')?.textContent).toBe(
      'Declarative content'
    );
  });
});
