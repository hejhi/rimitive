import { connect, type ConnectedApi } from '@lattice/router';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';

export const Home = connect((api: ConnectedApi<DOMRendererConfig>) => () => {
  return api.el('div', { className: 'page home-page' })(
    api.el('h2')('Welcome to SSR + Router'),
    api.el('p', { className: 'lead' })(
      'This example demonstrates server-side rendering with routing using the universal API.'
    ),

    api.el('section', { className: 'features' })(
      api.el('h3')('Features Demonstrated:'),
      api.el('ul')(
        api.el('li')('✓ Server-side rendering with router context'),
        api.el('li')('✓ Universal API - same code on server and client'),
        api.el('li')('✓ Multiple routes with different rendering modes'),
        api.el('li')('✓ Static pages (no JS)'),
        api.el('li')('✓ Interactive islands (selective hydration)'),
        api.el('li')('✓ Client-side navigation after hydration')
      )
    ),

    api.el('section', { className: 'cta' })(
      api.el('p')('Try navigating between pages to see SSR in action!'),
      api.el('button', {
        className: 'primary-btn',
        onclick: () => api.navigate('/about'),
      })('Learn More →')
    )
  );
});
