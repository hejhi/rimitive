/**
 * @fileoverview Real-world scenario benchmarks
 *
 * Simulates actual application usage patterns
 */

import { describe, bench } from 'vitest';
import { create } from 'zustand';
import { zustandAdapter } from '@lattice/adapter-zustand';
import { configureStore } from '@reduxjs/toolkit';
import { latticeReducer, reduxAdapter } from '@lattice/adapter-redux';
import { createStore as createStoreReactStore } from '@lattice/adapter-store-react';
import { compose } from '@lattice/core';
import type { RuntimeSliceFactory } from '@lattice/core';

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
    const getInitialState = (): EcommerceState => ({
      cart: [],
      user: null,
      products: [],
      ui: {
        isLoading: false,
        cartOpen: false,
        selectedProduct: null,
      },
    });

    // Pre-initialize stores with products and user
    const initializeEcommerceStore = <
      T extends ReturnType<typeof createEcommerceApp>,
    >(
      store: T
    ) => {
      // Load products
      const productList = Array.from({ length: 100 }, (_, i) => ({
        id: `prod-${i}`,
        name: `Product ${i}`,
        price: Math.random() * 100,
        stock: Math.floor(Math.random() * 50),
      }));
      store.products.selector.loadProducts(productList);

      // Login user
      store.user.selector.login({
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
      });

      return store;
    };

    const createEcommerceApp = (
      createSlice: RuntimeSliceFactory<EcommerceState>
    ) => {
      const cart = createSlice(
        ({
          get,
          set,
        }: {
          get: () => EcommerceState;
          set: (updates: Partial<EcommerceState>) => void;
        }) => ({
          addItem: (productId: string, quantity: number = 1) => {
            const products = get().products;
            const product = products.find((p) => p.id === productId);
            if (!product) return;

            const currentCart = get().cart;
            const existingItem = currentCart.find(
              (item) => item.id === productId
            );

            if (existingItem) {
              set({
                cart: currentCart.map((item) =>
                  item.id === productId
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
                ),
              });
            } else {
              set({
                cart: [
                  ...currentCart,
                  {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    quantity,
                  },
                ],
              });
            }
          },
          removeItem: (productId: string) => {
            set({
              cart: get().cart.filter((item) => item.id !== productId),
            });
          },
          updateQuantity: (productId: string, quantity: number) => {
            if (quantity <= 0) {
              set({ cart: get().cart.filter((item) => item.id !== productId) });
            } else {
              set({
                cart: get().cart.map((item) =>
                  item.id === productId ? { ...item, quantity } : item
                ),
              });
            }
          },
          getTotal: () => {
            return get().cart.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0
            );
          },
          getItemCount: () => {
            return get().cart.reduce((sum, item) => sum + item.quantity, 0);
          },
          clearCart: () => set({ cart: [] }),
        })
      );

      const products = createSlice(
        ({
          get,
          set,
        }: {
          get: () => EcommerceState;
          set: (updates: Partial<EcommerceState>) => void;
        }) => ({
          loadProducts: (productList: EcommerceState['products']) => {
            set({ products: productList });
          },
          updateStock: (productId: string, stock: number) => {
            set({
              products: get().products.map((p) =>
                p.id === productId ? { ...p, stock } : p
              ),
            });
          },
          getProduct: (id: string) => get().products.find((p) => p.id === id),
        })
      );

      const user = createSlice(
        ({
          get,
          set,
        }: {
          get: () => EcommerceState;
          set: (updates: Partial<EcommerceState>) => void;
        }) => ({
          login: (userData: { id: string; name: string; email: string }) => {
            set({ user: userData });
          },
          logout: () => {
            set({ user: null });
          },
          isLoggedIn: () => get().user !== null,
          getCurrentUser: () => get().user,
        })
      );

      const ui = createSlice(
        ({
          get,
          set,
        }: {
          get: () => EcommerceState;
          set: (updates: Partial<EcommerceState>) => void;
        }) => ({
          setLoading: (isLoading: boolean) => {
            set({ ui: { ...get().ui, isLoading } });
          },
          toggleCart: () => {
            set({ ui: { ...get().ui, cartOpen: !get().ui.cartOpen } });
          },
          selectProduct: (productId: string | null) => {
            set({ ui: { ...get().ui, selectedProduct: productId } });
          },
        })
      );

      // Composed checkout slice that depends on cart and user
      const checkout = createSlice(
        compose({ cart, user }, (_, { cart, user }) => ({
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
          },
        }))
      );

      return { cart, products, user, ui, checkout };
    };

    const zustandEcommerce = initializeEcommerceStore(
      (() => {
        const useStore = create<EcommerceState>(() => getInitialState());
        const createSlice = zustandAdapter(useStore);
        return createEcommerceApp(createSlice);
      })()
    );

    const reduxEcommerce = initializeEcommerceStore(
      (() => {
        const store = configureStore({
          reducer: latticeReducer.reducer,
          preloadedState: getInitialState(),
        });
        const createSlice = reduxAdapter<EcommerceState>(store);
        return createEcommerceApp(createSlice);
      })()
    );

    const storeReactEcommerce = initializeEcommerceStore(
      (() => {
        const createSlice = createStoreReactStore(getInitialState());
        return createEcommerceApp(createSlice);
      })()
    );

    bench('zustand - ecommerce simulation', () => {
      // Clear cart for consistent state
      zustandEcommerce.cart.selector.clearCart();

      // Simulate shopping behavior
      for (let i = 0; i < 50; i++) {
        const productId = `prod-${Math.floor(Math.random() * 100)}`;
        zustandEcommerce.ui.selector.selectProduct(productId);
        zustandEcommerce.cart.selector.addItem(
          productId,
          Math.floor(Math.random() * 3) + 1
        );

        if (i % 10 === 0) {
          zustandEcommerce.ui.selector.toggleCart();
        }

        if (i % 5 === 0 && zustandEcommerce.cart.selector.getItemCount() > 0) {
          const cartItems = zustandEcommerce.cart.selector.getItemCount();
          if (cartItems > 10) {
            // Remove some items
            zustandEcommerce.cart.selector.removeItem(
              `prod-${Math.floor(Math.random() * 100)}`
            );
          }
        }
      }

      // Checkout if possible
      if (zustandEcommerce.checkout.selector.canCheckout()) {
        zustandEcommerce.checkout.selector.processCheckout();
      }
    });

    bench('redux - ecommerce simulation', () => {
      // Clear cart for consistent state
      reduxEcommerce.cart.selector.clearCart();

      // Simulate shopping behavior
      for (let i = 0; i < 50; i++) {
        const productId = `prod-${Math.floor(Math.random() * 100)}`;
        reduxEcommerce.ui.selector.selectProduct(productId);
        reduxEcommerce.cart.selector.addItem(
          productId,
          Math.floor(Math.random() * 3) + 1
        );

        if (i % 10 === 0) {
          reduxEcommerce.ui.selector.toggleCart();
        }

        if (i % 5 === 0 && reduxEcommerce.cart.selector.getItemCount() > 0) {
          const cartItems = reduxEcommerce.cart.selector.getItemCount();
          if (cartItems > 10) {
            // Remove some items
            reduxEcommerce.cart.selector.removeItem(
              `prod-${Math.floor(Math.random() * 100)}`
            );
          }
        }
      }

      // Checkout if possible
      if (reduxEcommerce.checkout.selector.canCheckout()) {
        reduxEcommerce.checkout.selector.processCheckout();
      }
    });

    bench('store-react - ecommerce simulation', () => {
      // Clear cart for consistent state
      storeReactEcommerce.cart.selector.clearCart();

      // Simulate shopping behavior
      for (let i = 0; i < 50; i++) {
        const productId = `prod-${Math.floor(Math.random() * 100)}`;
        storeReactEcommerce.ui.selector.selectProduct(productId);
        storeReactEcommerce.cart.selector.addItem(
          productId,
          Math.floor(Math.random() * 3) + 1
        );

        if (i % 10 === 0) {
          storeReactEcommerce.ui.selector.toggleCart();
        }

        if (
          i % 5 === 0 &&
          storeReactEcommerce.cart.selector.getItemCount() > 0
        ) {
          const cartItems = storeReactEcommerce.cart.selector.getItemCount();
          if (cartItems > 10) {
            // Remove some items
            storeReactEcommerce.cart.selector.removeItem(
              `prod-${Math.floor(Math.random() * 100)}`
            );
          }
        }
      }

      // Checkout if possible
      if (storeReactEcommerce.checkout.selector.canCheckout()) {
        storeReactEcommerce.checkout.selector.processCheckout();
      }
    });
  });

  type TodoState = {
    todos: Array<{
      id: string;
      text: string;
      completed: boolean;
      tags: string[];
    }>;
    filter: 'all' | 'active' | 'completed';
    searchTerm: string;
    selectedTags: string[];
  };

  describe('Todo App with Filtering', () => {
    const getTodoInitialState = (): TodoState => ({
      todos: [],
      filter: 'all',
      searchTerm: '',
      selectedTags: [],
    });

    // Pre-initialize stores with todos
    const initializeTodoStore = <T extends ReturnType<typeof createTodoApp>>(
      store: T
    ) => {
      // Add initial todos
      for (let i = 0; i < 100; i++) {
        const tags = [`tag${i % 5}`, `priority${i % 3}`];
        store.todos.selector.addTodo(`Todo item ${i}`, tags);
      }

      // Toggle some todos as completed
      for (let i = 0; i < 50; i++) {
        const todos = store.queries.selector.getFilteredTodos();
        const todo = todos[i]?.id;

        if (todo) store.todos.selector.toggleTodo(todo);
      }

      return store;
    };

    const createTodoApp = (createSlice: RuntimeSliceFactory<TodoState>) => {
      const todos = createSlice(
        ({
          get,
          set,
        }: {
          get: () => TodoState;
          set: (updates: Partial<TodoState>) => void;
        }) => ({
          addTodo: (text: string, tags: string[] = []) => {
            set({
              todos: [
                ...get().todos,
                {
                  id: `todo-${Date.now()}`,
                  text,
                  completed: false,
                  tags,
                },
              ],
            });
          },
          toggleTodo: (id: string) => {
            set({
              todos: get().todos.map((todo) =>
                todo.id === id ? { ...todo, completed: !todo.completed } : todo
              ),
            });
          },
          deleteTodo: (id: string) => {
            set({
              todos: get().todos.filter((todo) => todo.id !== id),
            });
          },
          updateTodo: (id: string, text: string) => {
            set({
              todos: get().todos.map((todo) =>
                todo.id === id ? { ...todo, text } : todo
              ),
            });
          },
          clearCompleted: () => {
            set({
              todos: get().todos.filter((todo) => !todo.completed),
            });
          },
        })
      );

      const filters = createSlice(
        ({
          get,
          set,
        }: {
          get: () => TodoState;
          set: (updates: Partial<TodoState>) => void;
        }) => ({
          setFilter: (filter: 'all' | 'active' | 'completed') => {
            set({ filter });
          },
          setSearchTerm: (term: string) => {
            set({ searchTerm: term });
          },
          toggleTag: (tag: string) => {
            const selected = get().selectedTags;
            if (selected.includes(tag)) {
              set({ selectedTags: selected.filter((t) => t !== tag) });
            } else {
              set({ selectedTags: [...selected, tag] });
            }
          },
          clearFilters: () => {
            set({ filter: 'all', searchTerm: '', selectedTags: [] });
          },
        })
      );

      const queries = createSlice(({ get }: { get: () => TodoState }) => ({
        getFilteredTodos: () => {
          let todos = get().todos;

          // Filter by completion status
          if (get().filter === 'active') {
            todos = todos.filter((t) => !t.completed);
          } else if (get().filter === 'completed') {
            todos = todos.filter((t) => t.completed);
          }

          // Filter by search term
          const searchTerm = get().searchTerm.toLowerCase();
          if (searchTerm) {
            todos = todos.filter((t) =>
              t.text.toLowerCase().includes(searchTerm)
            );
          }

          // Filter by tags
          const selectedTags = get().selectedTags;
          if (selectedTags.length > 0) {
            todos = todos.filter((t) =>
              selectedTags.some((tag) => t.tags.includes(tag))
            );
          }

          return todos;
        },
        getStats: () => {
          const todos = get().todos;
          return {
            total: todos.length,
            active: todos.filter((t) => !t.completed).length,
            completed: todos.filter((t) => t.completed).length,
          };
        },
        getAllTags: () => {
          const tags = new Set<string>();
          get().todos.forEach((todo) => {
            todo.tags.forEach((tag) => tags.add(tag));
          });
          return Array.from(tags);
        },
      }));

      return { todos, filters, queries };
    };

    const zustandTodo = initializeTodoStore(
      (() => {
        const useStore = create<TodoState>(() => getTodoInitialState());
        const createSlice = zustandAdapter(useStore);
        return createTodoApp(createSlice);
      })()
    );

    const reduxTodo = initializeTodoStore(
      (() => {
        const store = configureStore({
          reducer: latticeReducer.reducer,
          preloadedState: getTodoInitialState(),
        });
        const createSlice = reduxAdapter<TodoState>(store);
        return createTodoApp(createSlice);
      })()
    );

    const storeReactTodo = initializeTodoStore(
      (() => {
        const createSlice = createStoreReactStore(getTodoInitialState());
        return createTodoApp(createSlice);
      })()
    );

    bench('zustand - todo app simulation', () => {
      // Reset filters for consistent state
      zustandTodo.filters.selector.clearFilters();

      // Apply filters and get results
      zustandTodo.filters.selector.setFilter('active');
      zustandTodo.queries.selector.getFilteredTodos();

      zustandTodo.filters.selector.setSearchTerm('item 1');
      zustandTodo.queries.selector.getFilteredTodos();

      zustandTodo.filters.selector.toggleTag('tag1');
      zustandTodo.filters.selector.toggleTag('priority0');
      zustandTodo.queries.selector.getFilteredTodos();

      // Get stats
      zustandTodo.queries.selector.getStats();

      // Update some todos
      for (let i = 0; i < 20; i++) {
        const todos = zustandTodo.queries.selector.getFilteredTodos();
        const todoId = todos[i]?.id;
        if (todoId) {
          zustandTodo.todos.selector.updateTodo(todoId, `Updated ${i}`);
        }
      }

      // Clear completed
      zustandTodo.todos.selector.clearCompleted();
    });

    bench('redux - todo app simulation', () => {
      // Reset filters for consistent state
      reduxTodo.filters.selector.clearFilters();

      // Apply filters and get results
      reduxTodo.filters.selector.setFilter('active');
      reduxTodo.queries.selector.getFilteredTodos();

      reduxTodo.filters.selector.setSearchTerm('item 1');
      reduxTodo.queries.selector.getFilteredTodos();

      reduxTodo.filters.selector.toggleTag('tag1');
      reduxTodo.filters.selector.toggleTag('priority0');
      reduxTodo.queries.selector.getFilteredTodos();

      // Get stats
      reduxTodo.queries.selector.getStats();

      // Update some todos
      for (let i = 0; i < 20; i++) {
        const todos = reduxTodo.queries.selector.getFilteredTodos();
        const todoId = todos[i]?.id;

        if (todoId) {
          reduxTodo.todos.selector.updateTodo(todoId, `Updated ${i}`);
        }
      }

      // Clear completed
      reduxTodo.todos.selector.clearCompleted();
    });

    bench('store-react - todo app simulation', () => {
      // Reset filters for consistent state
      storeReactTodo.filters.selector.clearFilters();

      // Apply filters and get results
      storeReactTodo.filters.selector.setFilter('active');
      storeReactTodo.queries.selector.getFilteredTodos();

      storeReactTodo.filters.selector.setSearchTerm('item 1');
      storeReactTodo.queries.selector.getFilteredTodos();

      storeReactTodo.filters.selector.toggleTag('tag1');
      storeReactTodo.filters.selector.toggleTag('priority0');
      storeReactTodo.queries.selector.getFilteredTodos();

      // Get stats
      storeReactTodo.queries.selector.getStats();

      // Update some todos
      for (let i = 0; i < 20; i++) {
        const todos = storeReactTodo.queries.selector.getFilteredTodos();
        const todoId = todos[i]?.id;
        if (todoId) {
          storeReactTodo.todos.selector.updateTodo(todoId, `Updated ${i}`);
        }
      }

      // Clear completed
      storeReactTodo.todos.selector.clearCompleted();
    });
  });
});
