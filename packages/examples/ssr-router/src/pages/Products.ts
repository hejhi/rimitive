/**
 * Products Page (Contains Island)
 *
 * This page includes an interactive island component.
 */
import { connect, type ConnectedApi } from '@lattice/router';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
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

export const Products = connect(
  (api: ConnectedApi<DOMRendererConfig>) => () => {
    return api.el('div', { className: 'page products-page' })(
      api.el('h2')('Products'),

      // Static content
      api.el('section', { className: 'intro' })(
        api.el('p')(
          'This page demonstrates mixing static content with interactive islands.'
        ),
        api.el('p')(
          "The product filter below is an island - it's interactive and ships JavaScript."
        )
      ),

      // Interactive island
      api.el('section', { className: 'product-filter-section' })(productFilter),

      // More static content
      api.el('section', { className: 'card' })(
        api.el('h3')('Why Islands?'),
        api.el('p')(
          'Islands architecture lets you ship JavaScript only for interactive components. ' +
            'The rest of the page is static HTML - faster to load and better for SEO.'
        )
      )
    );
  }
);
