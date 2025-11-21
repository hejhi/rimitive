import { router, useSvc } from '../service';

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

export const Product = router.connect(({ navigate }, { params }) =>
  useSvc(({ el, computed }) => () => {
    const id = computed(() => params().id || '');
    const productData = computed(() => products[id()]);

    return el('div', { className: 'product-detail' })(
      el('h2')(computed(() => productData()?.name || 'Product Not Found')),
      el('div', { className: 'product-meta' })(
        el('span', { className: 'product-id' })(
          computed(() => `Product ID: ${id()}`)
        ),
        el('span', { className: 'product-price-large' })(
          computed(() => productData()?.price || 'N/A')
        )
      ),
      el('p', { className: 'product-description-large' })(
        computed(() => productData()?.description || 'No description available')
      ),
      el('div', { className: 'card' })(
        el('h3')('Details'),
        el('p')(
          computed(() => productData()?.details || 'No details available')
        )
      ),
      el('div', { className: 'button-group' })(
        el('button', {
          className: 'secondary-btn',
          onclick: () => navigate('/products'),
        })('← Back to Products'),
        el('button', {
          className: 'primary-btn',
          onclick: () => navigate('/'),
        })('Home')
      )
    );
  })
);
