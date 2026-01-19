import type { Service } from '../service';

export const About =
  ({ el, router }: Service) =>
  () => {
    const { navigate } = router;
    return el('div').props({ className: 'page' })(
      el('h2')('About Rimitive Router'),
      el('p')(
        'The ',
        el('code')('@rimitive/router'),
        ' package provides minimal client-side routing for Rimitive applications.'
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
  };
