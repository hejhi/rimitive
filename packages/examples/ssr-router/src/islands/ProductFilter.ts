/**
 * Product Filter Island
 *
 * An interactive component that filters products by category.
 * This is an island - it will be hydrated on the client.
 */
import { island, type Service, router } from '../service.js';
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

// Helper hook - takes computed directly instead of using useSvc
// (useSvc is for components that return RefSpecs, not hooks that return values)
const useFilters = (
  computed: <T>(fn: () => T) => Reactive<T>,
  {
    products,
    category,
  }: ProductFilterProps & { category: Reactive<string> }
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

export const ProductFilter = island<ProductFilterProps, Service>(
  'ProductFilter',
  ({ el, signal, computed, map }) =>
    ({ products }) => {
      const selectedCategory = signal<string>('all');
      const { categories, filteredProducts } = useFilters(computed, {
        products,
        category: selectedCategory,
      });

      // Inline ProductCard - uses el/computed from outer closure, product from map
      const productCards = map(filteredProducts, (p) => p.id)((product) => {
        const name = computed(() => product().name);
        const cat = computed(() => product().category);
        const price = computed(() => `$${product().price}`);
        const productId = computed(() => product().id);

        return el('div', {
          className: 'product-card clickable',
          onclick: () => router.navigate(`/products/${productId()}`),
        })(
          el('h4')(name),
          el('p', { className: 'category' })(cat),
          el('p', { className: 'price' })(price),
          el('span', { className: 'view-details' })('View details →')
        );
      });
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
);
