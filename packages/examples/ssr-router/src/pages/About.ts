import { connect, type ConnectedApi } from '@lattice/router';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';

export const About = connect((api: ConnectedApi<DOMRendererConfig>) => () => {
  return api.el('div', { className: 'page about-page' })(
    api.el('h2')('About This Example'),

    api.el('section', { className: 'card' })(
      api.el('h3')('How It Works'),
      api.el('p')(
        "This example uses the router's universal API that works seamlessly on both server and client."
      ),
      api.el('ol')(
        api.el('li')('Server receives a request for a specific URL'),
        api.el('li')('Router context is created with the request URL'),
        api.el('li')('App renders within the router context on the server'),
        api.el('li')(
          'Router uses SSR context to determine which route to render'
        ),
        api.el('li')('HTML is sent to the client with inline island data'),
        api.el('li')('Client hydrates interactive islands only'),
        api.el('li')('Router continues working on client for navigation')
      )
    ),

    api.el('section', { className: 'card' })(
      api.el('h3')('Universal API'),
      api.el('p')(
        'The same router API works everywhere - no special SSR-specific code needed!'
      ),
      api.el('ul')(
        api.el('li')(
          'On server: Router reads from SSR context (createRouterContext)'
        ),
        api.el('li')('On client: Router reads from window.location'),
        api.el('li')('Environment detection is automatic')
      )
    ),

    api.el('section', { className: 'card' })(
      api.el('h3')('This Page'),
      api.el('p')(
        'This about page is completely static - no JavaScript shipped for this content.'
      )
    )
  );
});
