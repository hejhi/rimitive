/**
 * Add to Cart Component
 *
 * An interactive component for the product detail page.
 * Reactively responds to route changes using currentPath from the service.
 *
 * Props provide initial values for SSR, but on client the component
 * derives current state from the URL for proper navigation support.
 */
import type { Service } from '../service.js';

const products = [
  { id: 1, name: 'Laptop', price: 999 },
  { id: 2, name: 'Desk Chair', price: 299 },
  { id: 3, name: 'Coffee Maker', price: 79 },
  { id: 4, name: 'Monitor', price: 399 },
  { id: 5, name: 'Bookshelf', price: 149 },
  { id: 6, name: 'Blender', price: 59 },
];

type AddToCartProps = {
  productId: number;
  productName: string;
  price: number;
};

export const AddToCart =
  ({ el, signal, computed, router }: Service) =>
  (initialProps: AddToCartProps) => {
    // Use currentPath to reactively derive current product
    // Falls back to initial props if path doesn't match
    const currentProduct = computed(() => {
      const path = router.currentPath();
      const match = path.match(/^\/products\/(\d+)/);
      if (match?.[1]) {
        const id = parseInt(match[1], 10);
        const found = products.find((p) => p.id === id);
        if (found) return found;
      }
      // Fallback to initial props
      return {
        id: initialProps.productId,
        name: initialProps.productName,
        price: initialProps.price,
      };
    });

    const quantity = signal(1);
    const isAdded = signal(false);

    const total = computed(() => currentProduct().price * quantity());
    const buttonText = computed(() =>
      isAdded() ? '✓ Added to cart!' : `Add to Cart - $${total()}`
    );

    const handleAdd = () => {
      const product = currentProduct();
      console.log(
        `Added ${quantity()} x ${product.name} (ID: ${product.id}) to cart`
      );
      isAdded(true);

      // Reset after 2 seconds
      setTimeout(() => isAdded(false), 2000);
    };

    const decrement = () => {
      if (quantity() > 1) {
        quantity(quantity() - 1);
      }
    };

    const increment = () => {
      if (quantity() < 10) {
        quantity(quantity() + 1);
      }
    };

    return el('div').props({ className: 'add-to-cart-island' })(
      el('div').props({ className: 'quantity-selector' })(
        el('button').props({
          className: 'qty-btn',
          onclick: decrement,
          disabled: computed(() => quantity() <= 1),
        })('−'),
        el('span').props({ className: 'qty-display' })(
          computed(() => `${quantity()}`)
        ),
        el('button').props({
          className: 'qty-btn',
          onclick: increment,
          disabled: computed(() => quantity() >= 10),
        })('+')
      ),
      el('button').props({
        className: computed(() => (isAdded() ? 'add-btn added' : 'add-btn')),
        onclick: handleAdd,
        disabled: isAdded,
      })(buttonText)
    );
  };
