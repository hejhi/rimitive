/**
 * @fileoverview Real-world application benchmarks
 * 
 * Tests Lattice performance with realistic application patterns:
 * - E-commerce shopping cart with inventory
 * - Todo app with filtering and sorting
 * - Dashboard with real-time updates
 */

import { bench, describe } from 'vitest';
import { createComponent, createModel, createSlice, compose } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { createReduxAdapter } from '@lattice/adapter-redux';

describe('Real-World Application Performance', () => {
  // E-commerce cart component
  const createEcommerceComponent = () => {
    return createComponent(() => {
      interface Product {
        id: string;
        name: string;
        price: number;
        inventory: number;
        category: string;
      }

      interface CartItem {
        productId: string;
        quantity: number;
      }

      const model = createModel<{
        products: Product[];
        cart: CartItem[];
        selectedCategory: string | null;
        searchQuery: string;
        promoCode: string | null;
        addToCart: (productId: string, quantity: number) => void;
        removeFromCart: (productId: string) => void;
        updateQuantity: (productId: string, quantity: number) => void;
        applyPromoCode: (code: string) => void;
        setCategory: (category: string | null) => void;
        setSearchQuery: (query: string) => void;
      }>(({ set, get }) => ({
        products: Array.from({ length: 1000 }, (_, i) => ({
          id: `prod-${i}`,
          name: `Product ${i}`,
          price: Math.random() * 100 + 10,
          inventory: Math.floor(Math.random() * 100),
          category: ['Electronics', 'Clothing', 'Food', 'Books'][i % 4]!,
        })),
        cart: [],
        selectedCategory: null,
        searchQuery: '',
        promoCode: null,

        addToCart: (productId, quantity) => {
          const { cart, products } = get();
          const product = products.find((p) => p.id === productId);
          if (!product || product.inventory < quantity) return;

          const existing = cart.find((item) => item.productId === productId);
          if (existing) {
            set({
              cart: cart.map((item) =>
                item.productId === productId
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            });
          } else {
            set({ cart: [...cart, { productId, quantity }] });
          }
        },

        removeFromCart: (productId) => {
          const { cart } = get();
          set({ cart: cart.filter((item) => item.productId !== productId) });
        },

        updateQuantity: (productId, quantity) => {
          if (quantity <= 0) {
            get().removeFromCart(productId);
            return;
          }
          const { cart } = get();
          set({
            cart: cart.map((item) =>
              item.productId === productId ? { ...item, quantity } : item
            ),
          });
        },

        applyPromoCode: (code) => set({ promoCode: code }),
        setCategory: (category) => set({ selectedCategory: category }),
        setSearchQuery: (query) => set({ searchQuery: query.toLowerCase() }),
      }));

      const actions = createSlice(model, (m) => ({
        addToCart: m.addToCart,
        removeFromCart: m.removeFromCart,
        updateQuantity: m.updateQuantity,
        applyPromoCode: m.applyPromoCode,
        setCategory: m.setCategory,
        setSearchQuery: m.setSearchQuery,
      }));

      // Filtered products view
      const filteredProducts = createSlice(model, (m) => {
        let products = m.products;

        if (m.selectedCategory) {
          products = products.filter((p) => p.category === m.selectedCategory);
        }

        if (m.searchQuery) {
          products = products.filter((p) =>
            p.name.toLowerCase().includes(m.searchQuery)
          );
        }

        return products;
      });

      // Cart details with product info
      const cartDetails = createSlice(
        model,
        compose({ filtered: filteredProducts }, (m, _deps) => {
          const items = m.cart.map((item) => {
            const product = m.products.find((p) => p.id === item.productId);
            return product
              ? {
                  ...item,
                  product,
                  subtotal: product.price * item.quantity,
                }
              : null;
          }).filter(Boolean);

          const subtotal = items.reduce((sum, item) => sum + item!.subtotal, 0);
          const discount = m.promoCode === 'SAVE20' ? subtotal * 0.2 : 0;
          const tax = (subtotal - discount) * 0.08;
          const total = subtotal - discount + tax;

          return {
            items,
            subtotal,
            discount,
            tax,
            total,
            itemCount: items.length,
          };
        })
      );

      // Inventory warnings
      const inventoryWarnings = createSlice(
        model,
        compose({ cart: cartDetails }, (_, { cart }) => {
          const warnings: Array<{ productId: string; message: string }> = [];

          cart.items.forEach((item) => {
            if (item!.product.inventory < item!.quantity) {
              warnings.push({
                productId: item!.productId,
                message: `Only ${item!.product.inventory} available`,
              });
            } else if (item!.product.inventory < item!.quantity * 2) {
              warnings.push({
                productId: item!.productId,
                message: 'Low stock',
              });
            }
          });

          return warnings;
        })
      );

      return {
        model,
        actions,
        views: {
          products: filteredProducts,
          cart: cartDetails,
          warnings: inventoryWarnings,
        },
      };
    });
  };

  describe('E-commerce Shopping Cart', () => {
    bench('Zustand - Add 50 items to cart', () => {
      const store = createZustandAdapter(createEcommerceComponent());

      for (let i = 0; i < 50; i++) {
        store.actions.addToCart(`prod-${i}`, 1);
      }
    });

    bench('Redux - Add 50 items to cart', () => {
      const store = createReduxAdapter(createEcommerceComponent());

      for (let i = 0; i < 50; i++) {
        store.actions.addToCart(`prod-${i}`, 1);
      }
    });

    bench('Zustand - Filter products (1000 items)', () => {
      const store = createZustandAdapter(createEcommerceComponent());

      // Add some items to cart first
      for (let i = 0; i < 10; i++) {
        store.actions.addToCart(`prod-${i}`, 2);
      }

      // Perform filtering operations
      store.actions.setCategory('Electronics');
      store.views.products(); // Access filtered view

      store.actions.setSearchQuery('Product 1');
      store.views.products(); // Access filtered view

      store.actions.setCategory(null);
      store.views.products(); // Access filtered view
    });

    bench('Zustand - Calculate cart totals (50 items)', () => {
      const store = createZustandAdapter(createEcommerceComponent());

      // Add 50 items
      for (let i = 0; i < 50; i++) {
        store.actions.addToCart(`prod-${i}`, Math.floor(Math.random() * 5) + 1);
      }

      // Apply promo code
      store.actions.applyPromoCode('SAVE20');

      // Access cart details multiple times
      for (let i = 0; i < 10; i++) {
        const cart = store.views.cart();
        const warnings = store.views.warnings();
        // Simulate reading the values
        if (cart.total > 1000 || warnings.length > 0) {
          // no-op
        }
      }
    });
  });

  // Dashboard component with real-time metrics
  const createDashboardComponent = () => {
    return createComponent(() => {
      interface Metric {
        id: string;
        name: string;
        value: number;
        timestamp: number;
        category: 'sales' | 'traffic' | 'performance' | 'errors';
      }

      const model = createModel<{
        metrics: Metric[];
        timeRange: '1h' | '24h' | '7d' | '30d';
        selectedCategories: Set<string>;
        alertThreshold: number;
        addMetric: (metric: Omit<Metric, 'timestamp'>) => void;
        setTimeRange: (range: '1h' | '24h' | '7d' | '30d') => void;
        toggleCategory: (category: string) => void;
        setAlertThreshold: (threshold: number) => void;
      }>(({ set, get }) => ({
        metrics: [],
        timeRange: '24h',
        selectedCategories: new Set(['sales', 'traffic', 'performance', 'errors']),
        alertThreshold: 1000,

        addMetric: (metric) => {
          const { metrics } = get();
          const newMetric = { ...metric, timestamp: Date.now() };
          
          // Keep only last 10000 metrics
          const updated = [...metrics, newMetric];
          if (updated.length > 10000) {
            updated.shift();
          }
          
          set({ metrics: updated });
        },

        setTimeRange: (range) => set({ timeRange: range }),
        
        toggleCategory: (category) => {
          const { selectedCategories } = get();
          const newSet = new Set(selectedCategories);
          if (newSet.has(category)) {
            newSet.delete(category);
          } else {
            newSet.add(category);
          }
          set({ selectedCategories: newSet });
        },

        setAlertThreshold: (threshold) => set({ alertThreshold: threshold }),
      }));

      const actions = createSlice(model, (m) => ({
        addMetric: m.addMetric,
        setTimeRange: m.setTimeRange,
        toggleCategory: m.toggleCategory,
        setAlertThreshold: m.setAlertThreshold,
      }));

      // Time-filtered metrics
      const timeFilteredMetrics = createSlice(model, (m) => {
        const now = Date.now();
        const ranges = {
          '1h': 60 * 60 * 1000,
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000,
        };
        
        const cutoff = now - ranges[m.timeRange];
        
        return m.metrics.filter(
          (metric) =>
            metric.timestamp >= cutoff &&
            m.selectedCategories.has(metric.category)
        );
      });

      // Aggregated stats
      const stats = createSlice(
        model,
        compose({ filtered: timeFilteredMetrics }, (m, { filtered }) => {
          const byCategory = new Map<string, { sum: number; count: number; max: number }>();
          
          filtered.forEach((metric) => {
            const existing = byCategory.get(metric.category) || {
              sum: 0,
              count: 0,
              max: 0,
            };
            
            byCategory.set(metric.category, {
              sum: existing.sum + metric.value,
              count: existing.count + 1,
              max: Math.max(existing.max, metric.value),
            });
          });

          const alerts = filtered.filter((metric) => metric.value > m.alertThreshold);

          return {
            totalMetrics: filtered.length,
            byCategory: Array.from(byCategory.entries()).map(([category, data]) => ({
              category,
              average: data.sum / data.count,
              max: data.max,
              count: data.count,
            })),
            alerts: alerts.length,
            recentAlerts: alerts.slice(-10),
          };
        })
      );

      return {
        model,
        actions,
        views: {
          metrics: timeFilteredMetrics,
          stats,
        },
      };
    });
  };

  describe('Real-time Dashboard', () => {
    bench('Zustand - Process 1000 metric updates', () => {
      const store = createZustandAdapter(createDashboardComponent());

      // Simulate incoming metrics
      for (let i = 0; i < 1000; i++) {
        store.actions.addMetric({
          id: `metric-${i}`,
          name: `Metric ${i}`,
          value: Math.random() * 2000,
          category: ['sales', 'traffic', 'performance', 'errors'][i % 4] as any,
        });
      }
    });

    bench('Zustand - Dashboard view calculations (5000 metrics)', () => {
      const store = createZustandAdapter(createDashboardComponent());

      // Pre-populate with metrics
      for (let i = 0; i < 5000; i++) {
        store.actions.addMetric({
          id: `metric-${i}`,
          name: `Metric ${i}`,
          value: Math.random() * 2000,
          category: ['sales', 'traffic', 'performance', 'errors'][i % 4] as any,
        });
      }

      // Perform various view operations
      store.actions.setTimeRange('1h');
      let stats1 = store.views.stats();

      store.actions.setTimeRange('7d');
      let stats2 = store.views.stats();

      store.actions.toggleCategory('errors');
      let stats3 = store.views.stats();

      // Access metrics view
      store.views.metrics();
      
      // Simulate using the data
      if (stats1.totalMetrics + stats2.totalMetrics + stats3.totalMetrics > 0) {
        // no-op
      }
    });
  });
});