import type { Service } from '../service.js';

export const Home =
  ({ el, navigate }: Service) =>
  () =>
    el('div').props({ className: 'page home-page' })(
      el('h2')('Welcome to SSR + Router'),
      el('p').props({ className: 'lead' })(
        'This example demonstrates server-side rendering with routing using the universal API.'
      ),

      el('section').props({ className: 'features' })(
        el('h3')('Features Demonstrated:'),
        el('ul')(
          el('li')('✓ Server-side rendering with router context'),
          el('li')('✓ Universal API - same code on server and client'),
          el('li')('✓ Multiple routes with different rendering modes'),
          el('li')('✓ Static pages (no JS)'),
          el('li')('✓ Client-side navigation after hydration')
        )
      ),

      el('section').props({ className: 'cta' })(
        el('p')('Try navigating between pages to see SSR in action!'),
        el('button').props({
          className: 'primary-btn',
          onclick: () => navigate('/about'),
        })('Learn More →')
      )
    );
