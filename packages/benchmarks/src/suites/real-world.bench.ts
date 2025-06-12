/**
 * @fileoverview Real-world scenario benchmarks
 * 
 * Simulates actual application usage patterns
 */

import { describe, bench } from 'vitest';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { createReduxAdapter } from '@lattice/adapter-redux';
import { createStoreReactAdapter } from '@lattice/adapter-store-react';
import { compose } from '@lattice/core';
import type { CreateStore } from '@lattice/core';

type EcommerceState = {
  cart: Array<{ id: string; name: string; price: number; quantity: number }>;
  user: { id: string; name: string; email: string } | null;
  products: Array<{ id: string; name: string; price: number; stock: number }>;
  ui: {
    isLoading: boolean;
    cartOpen: boolean;
    selectedProduct: string | null;
  };
};

describe('Real-World Scenarios', () => {
  describe('E-commerce Cart Simulation', () => {
    const createEcommerceApp = (createStore: CreateStore<EcommerceState>) => {
      const createSlice = createStore({
        cart: [] as Array<{ id: string; name: string; price: number; quantity: number }>,
        user: null as { id: string; name: string; email: string } | null,
        products: [] as Array<{ id: string; name: string; price: number; stock: number }>,
        ui: {
          isLoading: false,
          cartOpen: false,
          selectedProduct: null as string | null
        }
      });

      const cart = createSlice(({ get, set }: { get: () => EcommerceState; set: (updates: Partial<EcommerceState>) => void }) => ({
        addItem: (productId: string, quantity: number = 1) => {
          const products = get().products;
          const product = products.find(p => p.id === productId);
          if (!product) return;

          const currentCart = get().cart;
          const existingItem = currentCart.find(item => item.id === productId);

          if (existingItem) {
            set({
              cart: currentCart.map(item =>
                item.id === productId
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              )
            });
          } else {
            set({
              cart: [...currentCart, {
                id: product.id,
                name: product.name,
                price: product.price,
                quantity
              }]
            });
          }
        },
        removeItem: (productId: string) => {
          set({
            cart: get().cart.filter(item => item.id !== productId)
          });
        },
        updateQuantity: (productId: string, quantity: number) => {
          if (quantity <= 0) {
            set({ cart: get().cart.filter(item => item.id !== productId) });
          } else {
            set({
              cart: get().cart.map(item =>
                item.id === productId ? { ...item, quantity } : item
              )
            });
          }
        },
        getTotal: () => {
          return get().cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        },
        getItemCount: () => {
          return get().cart.reduce((sum, item) => sum + item.quantity, 0);
        },
        clearCart: () => set({ cart: [] })
      }));

      const products = createSlice(({ get, set }: { get: () => EcommerceState; set: (updates: Partial<EcommerceState>) => void }) => ({
        loadProducts: (productList: EcommerceState['products']) => {
          set({ products: productList });
        },
        updateStock: (productId: string, stock: number) => {
          set({
            products: get().products.map(p =>
              p.id === productId ? { ...p, stock } : p
            )
          });
        },
        getProduct: (id: string) => get().products.find(p => p.id === id)
      }));

      const user = createSlice(({ get, set }: { get: () => EcommerceState; set: (updates: Partial<EcommerceState>) => void }) => ({
        login: (userData: { id: string; name: string; email: string }) => {
          set({ user: userData });
        },
        logout: () => {
          set({ user: null });
        },
        isLoggedIn: () => get().user !== null,
        getCurrentUser: () => get().user
      }));

      const ui = createSlice(({ get, set }: { get: () => EcommerceState; set: (updates: Partial<EcommerceState>) => void }) => ({
        setLoading: (isLoading: boolean) => {
          set({ ui: { ...get().ui, isLoading } });
        },
        toggleCart: () => {
          set({ ui: { ...get().ui, cartOpen: !get().ui.cartOpen } });
        },
        selectProduct: (productId: string | null) => {
          set({ ui: { ...get().ui, selectedProduct: productId } });
        }
      }));

      // Composed checkout slice that depends on cart and user
      const checkout = createSlice(
        compose(
          { cart, user },
          (_, { cart, user }) => ({
            canCheckout: () => {
              return user.isLoggedIn() && cart.getItemCount() > 0;
            },
            processCheckout: () => {
              if (!user.isLoggedIn()) {
                throw new Error('User must be logged in');
              }
              if (cart.getItemCount() === 0) {
                throw new Error('Cart is empty');
              }
              
              // Simulate checkout process
              const orderId = `order-${Date.now()}`;
              cart.clearCart();
              return orderId;
            }
          })
        )
      );

      return { cart, products, user, ui, checkout };
    };

    bench('zustand - ecommerce simulation', () => {
      const store = createZustandAdapter(createEcommerceApp);
      
      // Load products
      const productList = Array.from({ length: 100 }, (_, i) => ({
        id: `prod-${i}`,
        name: `Product ${i}`,
        price: Math.random() * 100,
        stock: Math.floor(Math.random() * 50)
      }));
      store.products.loadProducts(productList);

      // Simulate user session
      store.user.login({ id: 'user-1', name: 'Test User', email: 'test@example.com' });

      // Simulate shopping behavior
      for (let i = 0; i < 50; i++) {
        const productId = `prod-${Math.floor(Math.random() * 100)}`;
        store.ui.selectProduct(productId);
        store.cart.addItem(productId, Math.floor(Math.random() * 3) + 1);
        
        if (i % 10 === 0) {
          store.ui.toggleCart();
        }
        
        if (i % 5 === 0 && store.cart.getItemCount() > 0) {
          const cartItems = store.cart.getItemCount();
          if (cartItems > 10) {
            // Remove some items
            store.cart.removeItem(`prod-${Math.floor(Math.random() * 100)}`);
          }
        }
      }

      // Checkout if possible
      if (store.checkout.canCheckout()) {
        store.checkout.processCheckout();
      }

    });

    bench('redux - ecommerce simulation', () => {
      const store = createReduxAdapter(createEcommerceApp);
      
      // Load products
      const productList = Array.from({ length: 100 }, (_, i) => ({
        id: `prod-${i}`,
        name: `Product ${i}`,
        price: Math.random() * 100,
        stock: Math.floor(Math.random() * 50)
      }));
      store.products.loadProducts(productList);

      // Simulate user session
      store.user.login({ id: 'user-1', name: 'Test User', email: 'test@example.com' });

      // Simulate shopping behavior
      for (let i = 0; i < 50; i++) {
        const productId = `prod-${Math.floor(Math.random() * 100)}`;
        store.ui.selectProduct(productId);
        store.cart.addItem(productId, Math.floor(Math.random() * 3) + 1);
        
        if (i % 10 === 0) {
          store.ui.toggleCart();
        }
        
        if (i % 5 === 0 && store.cart.getItemCount() > 0) {
          const cartItems = store.cart.getItemCount();
          if (cartItems > 10) {
            // Remove some items
            store.cart.removeItem(`prod-${Math.floor(Math.random() * 100)}`);
          }
        }
      }

      // Checkout if possible
      if (store.checkout.canCheckout()) {
        store.checkout.processCheckout();
      }

    });

    bench('store-react - ecommerce simulation', () => {
      const store = createStoreReactAdapter(createEcommerceApp);
      
      // Load products
      const productList = Array.from({ length: 100 }, (_, i) => ({
        id: `prod-${i}`,
        name: `Product ${i}`,
        price: Math.random() * 100,
        stock: Math.floor(Math.random() * 50)
      }));
      store.products.loadProducts(productList);

      // Simulate user session
      store.user.login({ id: 'user-1', name: 'Test User', email: 'test@example.com' });

      // Simulate shopping behavior
      for (let i = 0; i < 50; i++) {
        const productId = `prod-${Math.floor(Math.random() * 100)}`;
        store.ui.selectProduct(productId);
        store.cart.addItem(productId, Math.floor(Math.random() * 3) + 1);
        
        if (i % 10 === 0) {
          store.ui.toggleCart();
        }
        
        if (i % 5 === 0 && store.cart.getItemCount() > 0) {
          const cartItems = store.cart.getItemCount();
          if (cartItems > 10) {
            // Remove some items
            store.cart.removeItem(`prod-${Math.floor(Math.random() * 100)}`);
          }
        }
      }

      // Checkout if possible
      if (store.checkout.canCheckout()) {
        store.checkout.processCheckout();
      }

    });
  });

  type TodoState = {
    todos: Array<{ id: string; text: string; completed: boolean; tags: string[] }>;
    filter: 'all' | 'active' | 'completed';
    searchTerm: string;
    selectedTags: string[];
  };

  describe('Todo App with Filtering', () => {
    const createTodoApp = (createStore: CreateStore<TodoState>) => {
      const createSlice = createStore({
        todos: [] as Array<{ id: string; text: string; completed: boolean; tags: string[] }>,
        filter: 'all' as 'all' | 'active' | 'completed',
        searchTerm: '',
        selectedTags: [] as string[]
      });

      const todos = createSlice(({ get, set }: { get: () => TodoState; set: (updates: Partial<TodoState>) => void }) => ({
        addTodo: (text: string, tags: string[] = []) => {
          set({
            todos: [...get().todos, {
              id: `todo-${Date.now()}`,
              text,
              completed: false,
              tags
            }]
          });
        },
        toggleTodo: (id: string) => {
          set({
            todos: get().todos.map(todo =>
              todo.id === id ? { ...todo, completed: !todo.completed } : todo
            )
          });
        },
        deleteTodo: (id: string) => {
          set({
            todos: get().todos.filter(todo => todo.id !== id)
          });
        },
        updateTodo: (id: string, text: string) => {
          set({
            todos: get().todos.map(todo =>
              todo.id === id ? { ...todo, text } : todo
            )
          });
        },
        clearCompleted: () => {
          set({
            todos: get().todos.filter(todo => !todo.completed)
          });
        }
      }));

      const filters = createSlice(({ get, set }: { get: () => TodoState; set: (updates: Partial<TodoState>) => void }) => ({
        setFilter: (filter: 'all' | 'active' | 'completed') => {
          set({ filter });
        },
        setSearchTerm: (term: string) => {
          set({ searchTerm: term });
        },
        toggleTag: (tag: string) => {
          const selected = get().selectedTags;
          if (selected.includes(tag)) {
            set({ selectedTags: selected.filter(t => t !== tag) });
          } else {
            set({ selectedTags: [...selected, tag] });
          }
        },
        clearFilters: () => {
          set({ filter: 'all', searchTerm: '', selectedTags: [] });
        }
      }));

      const queries = createSlice(({ get }: { get: () => TodoState }) => ({
        getFilteredTodos: () => {
          let todos = get().todos;
          
          // Filter by completion status
          if (get().filter === 'active') {
            todos = todos.filter(t => !t.completed);
          } else if (get().filter === 'completed') {
            todos = todos.filter(t => t.completed);
          }
          
          // Filter by search term
          const searchTerm = get().searchTerm.toLowerCase();
          if (searchTerm) {
            todos = todos.filter(t => t.text.toLowerCase().includes(searchTerm));
          }
          
          // Filter by tags
          const selectedTags = get().selectedTags;
          if (selectedTags.length > 0) {
            todos = todos.filter(t => 
              selectedTags.some(tag => t.tags.includes(tag))
            );
          }
          
          return todos;
        },
        getStats: () => {
          const todos = get().todos;
          return {
            total: todos.length,
            active: todos.filter(t => !t.completed).length,
            completed: todos.filter(t => t.completed).length
          };
        },
        getAllTags: () => {
          const tags = new Set<string>();
          get().todos.forEach(todo => {
            todo.tags.forEach(tag => tags.add(tag));
          });
          return Array.from(tags);
        }
      }));

      return { todos, filters, queries };
    };

    bench('zustand - todo app simulation', () => {
      const store = createZustandAdapter(createTodoApp);
      
      // Add todos
      for (let i = 0; i < 100; i++) {
        const tags = [`tag${i % 5}`, `priority${i % 3}`];
        store.todos.addTodo(`Todo item ${i}`, tags);
      }

      // Toggle some todos
      for (let i = 0; i < 50; i++) {
        store.todos.toggleTodo(`todo-${Date.now() - i * 1000}`);
      }

      // Apply filters and get results
      store.filters.setFilter('active');
      store.queries.getFilteredTodos();
      
      store.filters.setSearchTerm('item 1');
      store.queries.getFilteredTodos();
      
      store.filters.toggleTag('tag1');
      store.filters.toggleTag('priority0');
      store.queries.getFilteredTodos();

      // Get stats
      store.queries.getStats();
      
      // Clear completed
      store.todos.clearCompleted();
    });

    bench('redux - todo app simulation', () => {
      const store = createReduxAdapter(createTodoApp);
      
      // Add todos
      for (let i = 0; i < 100; i++) {
        const tags = [`tag${i % 5}`, `priority${i % 3}`];
        store.todos.addTodo(`Todo item ${i}`, tags);
      }

      // Toggle some todos
      for (let i = 0; i < 50; i++) {
        store.todos.toggleTodo(`todo-${Date.now() - i * 1000}`);
      }

      // Apply filters and get results
      store.filters.setFilter('active');
      store.queries.getFilteredTodos();
      
      store.filters.setSearchTerm('item 1');
      store.queries.getFilteredTodos();
      
      store.filters.toggleTag('tag1');
      store.filters.toggleTag('priority0');
      store.queries.getFilteredTodos();

      // Get stats
      store.queries.getStats();
      
      // Clear completed
      store.todos.clearCompleted();
    });

    bench('store-react - todo app simulation', () => {
      const store = createStoreReactAdapter(createTodoApp);
      
      // Add todos
      for (let i = 0; i < 100; i++) {
        const tags = [`tag${i % 5}`, `priority${i % 3}`];
        store.todos.addTodo(`Todo item ${i}`, tags);
      }

      // Toggle some todos
      for (let i = 0; i < 50; i++) {
        store.todos.toggleTodo(`todo-${Date.now() - i * 1000}`);
      }

      // Apply filters and get results
      store.filters.setFilter('active');
      store.queries.getFilteredTodos();
      
      store.filters.setSearchTerm('item 1');
      store.queries.getFilteredTodos();
      
      store.filters.toggleTag('tag1');
      store.filters.toggleTag('priority0');
      store.queries.getFilteredTodos();

      // Get stats
      store.queries.getStats();
      
      // Clear completed
      store.todos.clearCompleted();
    });
  });
});