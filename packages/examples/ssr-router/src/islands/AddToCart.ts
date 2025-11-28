/**
 * Add to Cart Island
 *
 * An interactive component for the product detail page.
 * Demonstrates how islands receive route-specific data via props
 * (since islands can't access route params directly).
 */
import { island, type Service } from '../service.js';

interface AddToCartProps {
  productId: number;
  productName: string;
  price: number;
}

export const AddToCart = island<AddToCartProps, Service>(
  'AddToCart',
  ({ el, signal, computed }) =>
    ({ productId, productName, price }) => {
      const quantity = signal(1);
      const isAdded = signal(false);

      const total = computed(() => price * quantity());
      const buttonText = computed(() =>
        isAdded() ? '✓ Added to cart!' : `Add to Cart - $${total()}`
      );

      const handleAdd = () => {
        // In a real app, this would call an API
        console.log(
          `Added ${quantity()} x ${productName} (ID: ${productId}) to cart`
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

      return el('div', { className: 'add-to-cart-island' })(
        el('div', { className: 'quantity-selector' })(
          el('button', {
            className: 'qty-btn',
            onclick: decrement,
            disabled: computed(() => quantity() <= 1),
          })('−'),
          el('span', { className: 'qty-display' })(computed(() => `${quantity()}`)),
          el('button', {
            className: 'qty-btn',
            onclick: increment,
            disabled: computed(() => quantity() >= 10),
          })('+')
        ),
        el('button', {
          className: computed(() =>
            isAdded() ? 'add-btn added' : 'add-btn'
          ),
          onclick: handleAdd,
          disabled: isAdded,
        })(buttonText)
      );
    }
);
