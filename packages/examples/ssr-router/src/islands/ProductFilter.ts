/**
 * Product Filter Island
 *
 * An interactive component that filters products by category.
 * This is an island - it will be hydrated on the client.
 */
import { island } from '@lattice/islands/island';
import { create } from '../api.js';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
}

interface ProductFilterProps {
  products: Product[];
}

export const ProductFilter = island(
  'ProductFilter',
  create(({ el, signal, computed }) => (props: ProductFilterProps) => {
    // State
    const selectedCategory = signal<string>('all');

    // Derived state
    const filteredProducts = computed(() => {
      const category = selectedCategory();
      if (category === 'all') return props.products;
      return props.products.filter(p => p.category === category);
    });

    const categories = computed(() => {
      const cats = new Set(props.products.map(p => p.category));
      return ['all', ...Array.from(cats)];
    });

    return el('div', { className: 'product-filter-island' })(
      el('div', { className: 'filter-controls' })(
        el('label')('Filter by category: '),
        el('select', {
          value: computed(() => selectedCategory()),
          onchange: (e: Event) => {
            const target = e.target as HTMLSelectElement;
            selectedCategory(target.value);
          }
        })(
          () => categories().map(cat =>
            el('option', { value: cat })(
              cat.charAt(0).toUpperCase() + cat.slice(1)
            )()
          )
        )
      ),

      el('div', { className: 'products-grid' })(
        () => filteredProducts().map(product =>
          el('div', { className: 'product-card' })(
            el('h4')(product.name),
            el('p', { className: 'category' })(product.category),
            el('p', { className: 'price' })(`$${product.price}`)
          )()
        )
      ),

      el('p', { className: 'count' })(
        () => `Showing ${filteredProducts().length} of ${props.products.length} products`
      )
    )();
  })
);
