/**
 * Product Detail Page
 *
 * Receives params from the router match.
 */
import type { Service } from '../service';

const products: Record<
  string,
  { name: string; description: string; price: string; details: string }
> = {
  '1': {
    name: 'Apple',
    description: 'Fresh and crispy',
    price: '$1.99',
    details:
      'Crisp, juicy apples perfect for snacking or baking. Rich in fiber and vitamin C.',
  },
  '2': {
    name: 'Banana',
    description: 'Naturally sweet',
    price: '$0.99',
    details:
      'Sweet, creamy bananas packed with potassium and natural energy. Perfect for smoothies.',
  },
  '3': {
    name: 'Orange',
    description: 'Juicy citrus',
    price: '$1.49',
    details:
      'Fresh, juicy oranges bursting with vitamin C. Great for juice or eating fresh.',
  },
  '4': {
    name: 'Mango',
    description: 'Tropical delight',
    price: '$2.49',
    details:
      'Sweet, tropical mangoes with a rich, creamy texture. Perfect for fruit salads and smoothies.',
  },
  '5': {
    name: 'Strawberry',
    description: 'Berry delicious',
    price: '$3.99',
    details:
      'Fresh, sweet strawberries packed with antioxidants. Perfect for desserts and snacking.',
  },
};

export const ProductDetail =
  ({ el, router }: Service) =>
  ({ params }: { params: Record<string, string> }) => {
    const { id } = params as { id: string };
    const { navigate } = router;
    const product = products[id];

    if (!product) {
      return el('div').props({ className: 'product-detail' })(
        el('h2')('Product Not Found'),
        el('p')('The product you are looking for does not exist.'),
        el('button').props({
          className: 'primary-btn',
          onclick: () => navigate('/products'),
        })('Back to Products')
      );
    }

    return el('div').props({ className: 'product-detail' })(
      el('h2')(product.name),
      el('div').props({ className: 'product-meta' })(
        el('span').props({ className: 'product-id' })(`Product ID: ${id}`),
        el('span').props({ className: 'product-price-large' })(product.price)
      ),
      el('p').props({ className: 'product-description-large' })(
        product.description
      ),
      el('div').props({ className: 'card' })(
        el('h3')('Details'),
        el('p')(product.details)
      ),
      el('div').props({ className: 'button-group' })(
        el('button').props({
          className: 'secondary-btn',
          onclick: () => navigate('/products'),
        })('Back to Products'),
        el('button').props({
          className: 'primary-btn',
          onclick: () => navigate('/'),
        })('Home')
      )
    );
  };
