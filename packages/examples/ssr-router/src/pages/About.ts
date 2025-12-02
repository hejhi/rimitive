import { connect, type ConnectedApi } from '@lattice/router';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';

export const About = connect(
  ({ el }: ConnectedApi<DOMAdapterConfig>) =>
    () => {
      return el('div').props({ className: 'page about-page' })(
        el('h2')('About This Example'),

        el('section').props({ className: 'card' })(
          el('h3')('How It Works'),
          el('p')(
            "This example uses the router's universal API that works seamlessly on both server and client."
          ),
          el('ol')(
            el('li')('Server receives a request for a specific URL'),
            el('li')('Router context is created with the request URL'),
            el('li')('App renders within the router context on the server'),
            el('li')(
              'Router uses SSR context to determine which route to render'
            ),
            el('li')('HTML is sent to the client with inline island data'),
            el('li')('Client hydrates interactive islands only'),
            el('li')('Router continues working on client for navigation')
          )
        ),

        el('section').props({ className: 'card' })(
          el('h3')('Universal API'),
          el('p')(
            'The same router API works everywhere - no special SSR-specific code needed!'
          ),
          el('ul')(
            el('li')(
              'On server: Router reads from SSR context (createRouterContext)'
            ),
            el('li')('On client: Router reads from window.location'),
            el('li')('Environment detection is automatic')
          )
        ),

        el('section').props({ className: 'card' })(
          el('h3')('This Page'),
          el('p')(
            'This about page is completely static - no JavaScript shipped for this content.'
          )
        )
      );
    }
);
