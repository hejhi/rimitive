import type { Service } from '../service';

export const About =
  ({ el, navigate }: Service) =>
  () =>
    el('div').props({ className: 'page' })(
      el('h2')('About Lattice Router'),
      el('p')(
        'The ',
        el('code')('@lattice/router'),
        ' package provides minimal client-side routing for Lattice applications.'
      ),
      el('div').props({ className: 'card' })(
        el('h3')('Key Concepts:'),
        el('ul')(
          el('li')(
            el('strong')('Routes: '),
            'Define routes as pure data with IDs and paths'
          ),
          el('li')(
            el('strong')('Matching: '),
            'Use ',
            el('code')('router.matches'),
            ' signal with ',
            el('code')('match()'),
            ' to render based on URL'
          ),
          el('li')(
            el('strong')('Parameters: '),
            'Access dynamic route segments via matched route params'
          ),
          el('li')(
            el('strong')('Navigation: '),
            'Use ',
            el('code')('Link'),
            ' components or the ',
            el('code')('navigate()'),
            ' function'
          )
        )
      ),
      el('button').props({
        className: 'secondary-btn',
        onclick: () => navigate('/'),
      })('Back to Home')
    );
