import type { RouteComponent } from '@lattice/router';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';

const products: Record<string, { name: string; description: string; price: string; details: string }> = {
  '1': {
    name: 'Apple',
    description: 'Fresh and crispy',
    price: '$1.99',
    details: 'Crisp, juicy apples perfect for snacking or baking. Rich in fiber and vitamin C.'
  },
  '2': {
    name: 'Banana',
    description: 'Naturally sweet',
    price: '$0.99',
    details: 'Sweet, creamy bananas packed with potassium and natural energy. Perfect for smoothies.'
  },
  '3': {
    name: 'Orange',
    description: 'Juicy citrus',
    price: '$1.49',
    details: 'Fresh, juicy oranges bursting with vitamin C. Great for juice or eating fresh.'
  },
  '4': {
    name: 'Mango',
    description: 'Tropical delight',
    price: '$2.49',
    details: 'Sweet, tropical mangoes with a rich, creamy texture. Perfect for fruit salads and smoothies.'
  },
  '5': {
    name: 'Strawberry',
    description: 'Berry delicious',
    price: '$3.99',
    details: 'Fresh, sweet strawberries packed with antioxidants. Perfect for desserts and snacking.'
  },
};

export const Product: RouteComponent<DOMRendererConfig> = ({ el, params, navigate }) => {
  // Reactively access the :id parameter
  const productId = () => params().id || '';

  // Get product data based on the ID
  const product = () => products[productId()];

  return el('div', { className: 'page' })(
    () => {
      const p = product();

      if (!p) {
        return el('div', { className: 'not-found-content' })(
          el('h2')('Product Not Found'),
          el('p')(`No product found with ID: ${productId()}`),
          el('button', {
            className: 'secondary-btn',
            onclick: () => navigate('/products')
          })('← Back to Products')
        )();
      }

      return el('div', { className: 'product-detail' })(
        el('h2')(p.name),
        el('div', { className: 'product-meta' })(
          el('span', { className: 'product-id' })(`Product ID: ${productId()}`),
          el('span', { className: 'product-price-large' })(p.price)
        ),
        el('p', { className: 'product-description-large' })(p.description),
        el('div', { className: 'card' })(
          el('h3')('Details'),
          el('p')(p.details)
        ),
        el('div', { className: 'button-group' })(
          el('button', {
            className: 'secondary-btn',
            onclick: () => navigate('/products')
          })('← Back to Products'),
          el('button', {
            className: 'primary-btn',
            onclick: () => navigate('/')
          })('Home')
        )
      )();
    }
  )();
};
