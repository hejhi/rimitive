import { router, use } from '../api';
import { Link } from '@lattice/router';

const products = [
  { id: '1', name: 'Apple', description: 'Fresh and crispy', price: '$1.99' },
  { id: '2', name: 'Banana', description: 'Naturally sweet', price: '$0.99' },
  { id: '3', name: 'Orange', description: 'Juicy citrus', price: '$1.49' },
  { id: '4', name: 'Mango', description: 'Tropical delight', price: '$2.49' },
  {
    id: '5',
    name: 'Strawberry',
    description: 'Berry delicious',
    price: '$3.99',
  },
];

export const Products = router.connect((_route, { children }) =>
  use(({ el }) => () => {
    return el('div', { className: 'page' })(
      el('h2')('Products'),
      el('p')('Click on a product to view details with route parameters.'),
      el('div', { className: 'product-grid' })(
        ...products.map((product) =>
          el('div', { className: 'product-card' })(
            Link({
              href: `/products/${product.id}`,
              className: 'product-link',
            })(
              el('h3')(product.name),
              el('p', { className: 'product-description' })(
                product.description
              ),
              el('div', { className: 'product-price' })(product.price)
            )
          )()
        )
      ),
      // Render child route (Product detail) here
      ...(children || [])
    );
  })
);
