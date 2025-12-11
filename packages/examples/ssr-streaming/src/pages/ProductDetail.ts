/**
 * Product Detail Page
 *
 * Receives params from the router match.
 */
import type { Service } from '../service.js';
import { AddToCart } from '../components/AddToCart.js';

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

type ProductDetailProps = {
  params: { id: string };
};

export function ProductDetail(
  { el, navigate, use }: Service,
  { params }: ProductDetailProps
) {
  const id = parseInt(params.id, 10);
  const product = products.find((p) => p.id === id);

  if (!product) {
    return el('div').props({ className: 'page product-detail-page' })(
      el('h2')('Product Not Found'),
      el('p')('The product you are looking for does not exist.'),
      el('button').props({
        className: 'primary-btn',
        onclick: () => navigate('/products'),
      })('← Back to Products')
    );
  }

  return el('div').props({ className: 'page product-detail-page' })(
    el('nav').props({ className: 'breadcrumb' })(
      el('a').props({
        href: '/products',
        onclick: (e: Event) => {
          e.preventDefault();
          navigate('/products');
        },
      })('Products'),
      el('span')(' / '),
      el('span')(product.name)
    ),

    el('article').props({ className: 'product-detail card' })(
      el('header')(
        el('h2')(product.name),
        el('span').props({ className: 'category' })(product.category)
      ),

      el('p').props({ className: 'description' })(product.description),

      el('p').props({ className: 'price' })(`$${product.price}`),

      el('section').props({ className: 'add-to-cart-section' })(
        use(AddToCart)({
          productId: product.id,
          productName: product.name,
          price: product.price,
        })
      ),

      el('button').props({
        className: 'secondary-btn',
        onclick: () => navigate('/products'),
      })('← Back to Products')
    )
  );
}
