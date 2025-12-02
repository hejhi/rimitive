import { router, useSvc } from '../service';

export const About = router.connect(({ navigate }) =>
  useSvc(({ el }) => () => {
    return el('div').props({ className: 'page' })(
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
            'Define your application structure with nested route declarations'
          ),
          el('li')(
            el('strong')('Layouts: '),
            'Use the ',
            el('code')('children'),
            ' to compose layouts with child routes'
          ),
          el('li')(
            el('strong')('Parameters: '),
            'Access dynamic route segments via the ',
            el('code')('params()'),
            ' reactive signal'
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
      })('← Back to Home')
    );
  })
);
