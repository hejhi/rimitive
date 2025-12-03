/**
 * Product Filter Island
 *
 * An interactive component that filters products by category.
 * This is an island - it will be hydrated on the client.
 */
import { island } from '../service.js';
import type { Reactive } from '@lattice/view/types';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
}

interface ProductFilterProps {
  products: Product[];
}

const useFilters = (
  computed: <T>(fn: () => T) => Reactive<T>,
  { products, category }: ProductFilterProps & { category: Reactive<string> }
) => {
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
};

export const ProductFilter = island(
  'ProductFilter',
  ({ el, signal, computed, map, navigate }) =>
    ({ products }: ProductFilterProps) => {
      const selectedCategory = signal<string>('all');
      const { categories, filteredProducts } = useFilters(computed, {
        products,
        category: selectedCategory,
      });

      // Inline ProductCard - uses el from outer closure, product from map
      const productCards = map(
        filteredProducts,
        (p) => p.id,
        (productSignal) => {
          const product = productSignal();
          return el('div').props({
            className: 'product-card clickable',
            onclick: () => navigate(`/products/${product.id}`),
          })(
            el('h4')(product.name),
            el('p').props({ className: 'category' })(product.category),
            el('p').props({ className: 'price' })(`$${product.price}`),
            el('span').props({ className: 'view-details' })('View details →')
          );
        }
      );
      const categoryValues = map(categories, (catSignal) => {
        const cat = catSignal();
        return el('option').props({ value: cat })(
          cat.charAt(0).toUpperCase() + cat.slice(1)
        );
      });

      const count = computed(
        () =>
          `Showing ${filteredProducts().length} of ${products.length} products`
      );

      return el('div').props({ className: 'product-filter-island' })(
        el('div').props({ className: 'filter-controls' })(
          el('label')('Filter by category: '),
          el('select').props({
            value: selectedCategory,
            onchange: (e: Event) => {
              const target = e.target as HTMLSelectElement;
              selectedCategory(target.value);
            },
          })(categoryValues)
        ),
        el('div').props({ className: 'products-grid' })(productCards),
        el('p').props({ className: 'count' })(count)
      );
    }
);
