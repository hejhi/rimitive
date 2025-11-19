/**
 * Product Filter Island
 *
 * An interactive component that filters products by category.
 * This is an island - it will be hydrated on the client.
 */
import { island } from '@lattice/islands/island';
import { create } from '../api.js';
import { Reactive } from '@lattice/view/types';

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
  create(({ el, signal, computed, map }) => (props: ProductFilterProps) => {
    const selectedCategory = signal<string>('all');
    const filteredProducts = computed(() => {
      const category = selectedCategory();
      if (category === 'all') return props.products;
      return props.products.filter(p => p.category === category);
    });
    const categories = computed(() => {
      const cats = new Set(props.products.map(p => p.category));
      return ['all', ...Array.from(cats)];
    });
    const productCards = map(filteredProducts, (p) => p.id)(ProductCard);
    const categoryValues = map(categories)((cat) =>
      el('option', { value: cat })(
        computed(() => cat().charAt(0).toUpperCase() + cat().slice(1))
      )
    );
    const count = computed(
      () =>
        `Showing ${filteredProducts().length} of ${props.products.length} products`
    );

    return el('div', { className: 'product-filter-island' })(
      el('div', { className: 'filter-controls' })(
        el('label')('Filter by category: '),
        el('select', {
          value: selectedCategory,
          onchange: (e: Event) => {
            const target = e.target as HTMLSelectElement;
            selectedCategory(target.value);
          },
        })(categoryValues)
      ),
      el('div', { className: 'products-grid' })(productCards),
      el('p', { className: 'count' })(count)
    );
  })
);

const ProductCard = create(
  ({ el, computed }) =>
    (product: Reactive<Product>) => {
      const name = computed(() => product().name);
      const cat = computed(() => product().category);
      const price = computed(() => `$${product().price}`);

      return el('div', { className: 'product-card' })(
        el('h4')(name),
        el('p', { className: 'category' })(cat),
        el('p', { className: 'price' })(price)
      );
    }
);