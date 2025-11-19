import { createRouteComponent } from '@lattice/router';

export const Home = createRouteComponent(({ el, navigate }) => () => {
  return el('div', { className: 'page' })(
    el('h2')('Welcome Home'),
    el('p')('This is the home page of the Lattice Router example.'),
    el('div', { className: 'card' })(
      el('h3')('Features Demonstrated:'),
      el('ul')(
        el('li')('Multiple routes at root level'),
        el('li')('Nested routes with layouts'),
        el('li')('Route parameters (:id)'),
        el('li')('Link component for navigation'),
        el('li')('Programmatic navigation'),
        el('li')('Not found (404) handling')
      )
    ),
    el('button', {
      className: 'primary-btn',
      onclick: () => navigate('/products')
    })('Go to Products →')
  );
})();
