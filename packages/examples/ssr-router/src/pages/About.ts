import type { Service } from '../service.js';

export function About(svc: Service) {
  const { el } = svc;

  return el('div').props({ className: 'page about-page' })(
    el('h2')('About This Example'),

    el('section').props({ className: 'card' })(
      el('h3')('How It Works'),
      el('p')(
        "This example uses the router's universal API that works seamlessly on both server and client."
      ),
      el('ol')(
        el('li')('Server receives a request for a specific URL'),
        el('li')('Router matches path and provides route info'),
        el('li')('View layer renders matched component'),
        el('li')('HTML is sent to the client with inline island data'),
        el('li')('Client hydrates interactive islands only'),
        el('li')('Router continues working on client for navigation')
      )
    ),

    el('section').props({ className: 'card' })(
      el('h3')('Pure Reactive State'),
      el('p')(
        'The router is just reactive state - it provides matches, currentPath, and navigate.'
      ),
      el('ul')(
        el('li')('Router does NOT create elements'),
        el('li')('View layer uses match() to render based on router.matches()'),
        el('li')('Same code works on server and client')
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
