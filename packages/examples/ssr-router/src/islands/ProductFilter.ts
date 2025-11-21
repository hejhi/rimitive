/**
 * Product Filter Island
 *
 * An interactive component that filters products by category.
 * This is an island - it will be hydrated on the client.
 */
import { island } from '@lattice/islands/island';
import { withSvc, useSvc } from '../service.js';
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

// ProductCard helper - needs to use api from the island's scope
const ProductCard = useSvc(
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

const useFilters = useSvc(
  ({ computed }) =>
    ({
      products,
      category,
    }: ProductFilterProps & { category: Reactive<string> }) => {
      const filteredProducts = computed(() => {
        const selCategory = category();

        if (selCategory === 'all') return products;
        return products.filter((p) => p.category === selCategory);
      });

      const categories = computed(() => {
        const cats = new Set(products.map((p) => p.category));
        return ['all', ...Array.from(cats)];
      });

      return {
        categories,
        filteredProducts,
      };
    }
);

export const ProductFilter = island(
  'ProductFilter',
  withSvc(
    ({ el, signal, computed, map }) =>
      ({ products }: ProductFilterProps) => {
        const selectedCategory = signal<string>('all');
        const { categories, filteredProducts } = useFilters({
          products,
          category: selectedCategory,
        });

        const productCards = map(filteredProducts, (p) => p.id)(ProductCard);
        const categoryValues = map(categories)((cat) =>
          el('option', { value: cat })(
            computed(() => cat().charAt(0).toUpperCase() + cat().slice(1))
          )
        );

        const count = computed(
          () =>
            `Showing ${filteredProducts().length} of ${products.length} products`
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
      }
  )
);
