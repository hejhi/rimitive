import { use, router } from '../api.js';

export const Home = router.connect(({ navigate }) =>
  use(({ el }) => () => {
    return el('div', { className: 'page home-page' })(
      el('h2')('Welcome to SSR + Router'),
      el('p', { className: 'lead' })(
        'This example demonstrates server-side rendering with routing using the universal API.'
      ),

      el('section', { className: 'features' })(
        el('h3')('Features Demonstrated:'),
        el('ul')(
          el('li')('✓ Server-side rendering with router context'),
          el('li')('✓ Universal API - same code on server and client'),
          el('li')('✓ Multiple routes with different rendering modes'),
          el('li')('✓ Static pages (no JS)'),
          el('li')('✓ Interactive islands (selective hydration)'),
          el('li')('✓ Client-side navigation after hydration')
        )
      ),

      el('section', { className: 'cta' })(
        el('p')('Try navigating between pages to see SSR in action!'),
        el('button', {
          className: 'primary-btn',
          onclick: () => navigate('/about'),
        })('Learn More →')
      )
    );
  })
);
