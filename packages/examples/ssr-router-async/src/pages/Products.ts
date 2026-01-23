/**
 * Products Page
 */
import type { Service } from '../service.js';
import { ProductFilter } from '../components/ProductFilter.js';

const products = [
  { id: 1, name: 'Laptop', category: 'electronics', price: 999 },
  { id: 2, name: 'Desk Chair', category: 'furniture', price: 299 },
  { id: 3, name: 'Coffee Maker', category: 'appliances', price: 79 },
  { id: 4, name: 'Monitor', category: 'electronics', price: 399 },
  { id: 5, name: 'Bookshelf', category: 'furniture', price: 149 },
  { id: 6, name: 'Blender', category: 'appliances', price: 59 },
];

export const Products = (svc: Service) => () => {
  const { el } = svc;
  return el('div').props({ className: 'page products-page' })(
    el('h2')('Products'),

    // Static content
    el('section').props({ className: 'intro' })(
      el('p')(
        'This page demonstrates mixing static content with interactive components.'
      ),
      el('p')('The product filter below is interactive and fully hydrated.')
    ),

    // Interactive product filter
    el('section').props({ className: 'product-filter-section' })(
      svc(ProductFilter)({ products })
    ),

    // More static content
    el('section').props({ className: 'card' })(
      el('h3')('Full App Hydration'),
      el('p')(
        'This example uses full app hydration - the entire component tree is hydrated on the client. ' +
          'The SSR content is preserved and reactivity is wired up without replacing the DOM.'
      )
    )
  );
};
