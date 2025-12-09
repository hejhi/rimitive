/**
 * Product Detail Page
 *
 * Shows details for a single product based on route params.
 * Demonstrates using an island inside a connected route component.
 */
import { connect } from '../service.js';
import { AddToCart } from '../islands/AddToCart.js';

const products = [
  {
    id: 1,
    name: 'Laptop',
    category: 'electronics',
    price: 999,
    description: 'A powerful laptop for work and play.',
  },
  {
    id: 2,
    name: 'Desk Chair',
    category: 'furniture',
    price: 299,
    description: 'Ergonomic office chair with lumbar support.',
  },
  {
    id: 3,
    name: 'Coffee Maker',
    category: 'appliances',
    price: 79,
    description: 'Programmable coffee maker with thermal carafe.',
  },
  {
    id: 4,
    name: 'Monitor',
    category: 'electronics',
    price: 399,
    description: '27" 4K display with excellent color accuracy.',
  },
  {
    id: 5,
    name: 'Bookshelf',
    category: 'furniture',
    price: 149,
    description: '5-shelf bookcase in solid wood construction.',
  },
  {
    id: 6,
    name: 'Blender',
    category: 'appliances',
    price: 59,
    description: 'High-speed blender for smoothies and soups.',
  },
];

export const ProductDetail = connect(
  ({ el, navigate, computed, match }, { params }) =>
    () => {
      const product = computed(() => {
        const idParam = params().id;
        if (!idParam) return null;
        const id = parseInt(idParam, 10);
        return products.find((p) => p.id === id) ?? null;
      });

      // Create island once with reactive props
      // Note: Island props must be static at creation time for SSR hydration
      // The initial product data comes from the first params() value
      const initialProduct = product();
      const addToCart = initialProduct
        ? AddToCart({
            productId: initialProduct.id,
            productName: initialProduct.name,
            price: initialProduct.price,
          })
        : null;

      return match(product, (p) =>
        p === null
          ? el('div').props({ className: 'page product-detail-page' })(
              el('h2')('Product Not Found'),
              el('p')('The product you are looking for does not exist.'),
              el('button').props({
                className: 'primary-btn',
                onclick: () => navigate('/products'),
              })('← Back to Products')
            )
          : el('div').props({ className: 'page product-detail-page' })(
              el('nav').props({ className: 'breadcrumb' })(
                el('a').props({
                  href: '/products',
                  onclick: (e: Event) => {
                    e.preventDefault();
                    navigate('/products');
                  },
                })('Products'),
                el('span')(' / '),
                el('span')(p.name)
              ),

              el('article').props({ className: 'product-detail card' })(
                el('header')(
                  el('h2')(p.name),
                  el('span').props({ className: 'category' })(p.category)
                ),

                el('p').props({ className: 'description' })(p.description),

                el('p').props({ className: 'price' })(`$${p.price}`),

                // Interactive island - gets hydrated on client
                // Created once with initial product data
                ...(addToCart
                  ? [
                      el('section').props({
                        className: 'add-to-cart-section',
                      })(addToCart),
                    ]
                  : []),

                el('button').props({
                  className: 'secondary-btn',
                  onclick: () => navigate('/products'),
                })('← Back to Products')
              )
            )
      );
    }
);
