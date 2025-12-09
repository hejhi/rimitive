/**
 * Products Page (Contains Island)
 */
import type { Service } from '../service.js';
import { ProductFilter } from '../islands/ProductFilter.js';

const products = [
  { id: 1, name: 'Laptop', category: 'electronics', price: 999 },
  { id: 2, name: 'Desk Chair', category: 'furniture', price: 299 },
  { id: 3, name: 'Coffee Maker', category: 'appliances', price: 79 },
  { id: 4, name: 'Monitor', category: 'electronics', price: 399 },
  { id: 5, name: 'Bookshelf', category: 'furniture', price: 149 },
  { id: 6, name: 'Blender', category: 'appliances', price: 59 },
];

const productFilter = ProductFilter({ products });

export function Products(svc: Service) {
  const { el } = svc;

  return el('div').props({ className: 'page products-page' })(
    el('h2')('Products'),

    // Static content
    el('section').props({ className: 'intro' })(
      el('p')(
        'This page demonstrates mixing static content with interactive islands.'
      ),
      el('p')(
        "The product filter below is an island - it's interactive and ships JavaScript."
      )
    ),

    // Interactive island
    el('section').props({ className: 'product-filter-section' })(productFilter),

    // More static content
    el('section').props({ className: 'card' })(
      el('h3')('Why Islands?'),
      el('p')(
        'Islands architecture lets you ship JavaScript only for interactive components. ' +
          'The rest of the page is static HTML - faster to load and better for SEO.'
      )
    )
  );
}
