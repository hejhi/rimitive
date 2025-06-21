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
      store.products().loadProducts(productList);

      // Login user
      store.user().login({
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
        (selectors) => ({ 
          cart: selectors.cart,
          products: selectors.products
        }),
        ({ cart, products }, set) => ({
          addItem: (productId: string, quantity: number = 1) => {
            const productList = products();
            const product = productList.find((p) => p.id === productId);
            if (!product) return;

            const currentCart = cart();
            const existingItem = currentCart.find(
              (item) => item.id === productId
            );

            if (existingItem) {
              set(
                (selectors) => ({ cart: selectors.cart }),
                ({ cart }) => ({
                  cart: cart().map((item) =>
                    item.id === productId
                      ? { ...item, quantity: item.quantity + quantity }
                      : item
                  ),
                })
              );
            } else {
              set(
                (selectors) => ({ cart: selectors.cart }),
                ({ cart }) => ({
                  cart: [
                    ...cart(),
                    {
                      id: product.id,
                      name: product.name,
                      price: product.price,
                      quantity,
                    },
                  ],
                })
              );
            }
          },
          removeItem: (productId: string) => {
            set(
              (selectors) => ({ cart: selectors.cart }),
              ({ cart }) => ({
                cart: cart().filter((item) => item.id !== productId),
              })
            );
          },
          updateQuantity: (productId: string, quantity: number) => {
            if (quantity <= 0) {
              set(
                (selectors) => ({ cart: selectors.cart }),
                ({ cart }) => ({
                  cart: cart().filter((item) => item.id !== productId)
                })
              );
            } else {
              set(
                (selectors) => ({ cart: selectors.cart }),
                ({ cart }) => ({
                  cart: cart().map((item) =>
                    item.id === productId ? { ...item, quantity } : item
                  ),
                })
              );
            }
          },
          getTotal: () => {
            return cart().reduce(
              (sum, item) => sum + item.price * item.quantity,
              0
            );
          },
          getItemCount: () => {
            return cart().reduce((sum, item) => sum + item.quantity, 0);
          },
          clearCart: () => set(
            (selectors) => ({ cart: selectors.cart }),
            () => ({ cart: [] })
          ),
        })
      );

      const products = createSlice(
        (selectors) => ({ products: selectors.products }),
        ({ products }, set) => ({
          loadProducts: (productList: EcommerceState['products']) => {
            set(
              (selectors) => ({ products: selectors.products }),
              () => ({ products: productList })
            );
          },
          updateStock: (productId: string, stock: number) => {
            set(
              (selectors) => ({ products: selectors.products }),
              ({ products }) => ({
                products: products().map((p) =>
                  p.id === productId ? { ...p, stock } : p
                ),
              })
            );
          },
          getProduct: (id: string) => products().find((p) => p.id === id),
        })
      );

      const user = createSlice(
        (selectors) => ({ user: selectors.user }),
        ({ user }, set) => ({
          login: (userData: { id: string; name: string; email: string }) => {
            set(
              (selectors) => ({ user: selectors.user }),
              () => ({ user: userData })
            );
          },
          logout: () => {
            set(
              (selectors) => ({ user: selectors.user }),
              () => ({ user: null })
            );
          },
          isLoggedIn: () => user() !== null,
          getCurrentUser: () => user(),
        })
      );

      const ui = createSlice(
        (selectors) => ({ ui: selectors.ui }),
        ({}, set) => ({
          setLoading: (isLoading: boolean) => {
            set(
              (selectors) => ({ ui: selectors.ui }),
              ({ ui }) => ({ ui: { ...ui(), isLoading } })
            );
          },
          toggleCart: () => {
            set(
              (selectors) => ({ ui: selectors.ui }),
              ({ ui }) => ({ ui: { ...ui(), cartOpen: !ui().cartOpen } })
            );
          },
          selectProduct: (productId: string | null) => {
            set(
              (selectors) => ({ ui: selectors.ui }),
              ({ ui }) => ({ ui: { ...ui(), selectedProduct: productId } })
            );
          },
        })
      );

      // Composed checkout slice that depends on cart and user
      const checkout = createSlice(
        () => ({
          // Use slice composition to extract methods from other slices
          cartMethods: cart(({ getItemCount, clearCart }) => ({ getItemCount, clearCart })),
          userMethods: user(({ isLoggedIn }) => ({ isLoggedIn }))
        }),
        ({ cartMethods, userMethods }) => ({
          canCheckout: () => {
            return userMethods.isLoggedIn() && cartMethods.getItemCount() > 0;
          },
          processCheckout: () => {
            if (!userMethods.isLoggedIn()) {
              throw new Error('User must be logged in');
            }
            if (cartMethods.getItemCount() === 0) {
              throw new Error('Cart is empty');
            }

            // Simulate checkout process
            const orderId = `order-${Date.now()}`;
            cartMethods.clearCart();
            return orderId;
          },
        })
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
      zustandEcommerce.cart().clearCart();

      // Simulate shopping behavior
      for (let i = 0; i < 50; i++) {
        const productId = `prod-${Math.floor(Math.random() * 100)}`;
        zustandEcommerce.ui().selectProduct(productId);
        zustandEcommerce.cart().addItem(
          productId,
          Math.floor(Math.random() * 3) + 1
        );

        if (i % 10 === 0) {
          zustandEcommerce.ui().toggleCart();
        }

        if (i % 5 === 0 && zustandEcommerce.cart().getItemCount() > 0) {
          const cartItems = zustandEcommerce.cart().getItemCount();
          if (cartItems > 10) {
            // Remove some items
            zustandEcommerce.cart().removeItem(
              `prod-${Math.floor(Math.random() * 100)}`
            );
          }
        }
      }

      // Checkout if possible
      if (zustandEcommerce.checkout().canCheckout()) {
        zustandEcommerce.checkout().processCheckout();
      }
    });

    bench('redux - ecommerce simulation', () => {
      // Clear cart for consistent state
      reduxEcommerce.cart().clearCart();

      // Simulate shopping behavior
      for (let i = 0; i < 50; i++) {
        const productId = `prod-${Math.floor(Math.random() * 100)}`;
        reduxEcommerce.ui().selectProduct(productId);
        reduxEcommerce.cart().addItem(
          productId,
          Math.floor(Math.random() * 3) + 1
        );

        if (i % 10 === 0) {
          reduxEcommerce.ui().toggleCart();
        }

        if (i % 5 === 0 && reduxEcommerce.cart().getItemCount() > 0) {
          const cartItems = reduxEcommerce.cart().getItemCount();
          if (cartItems > 10) {
            // Remove some items
            reduxEcommerce.cart().removeItem(
              `prod-${Math.floor(Math.random() * 100)}`
            );
          }
        }
      }

      // Checkout if possible
      if (reduxEcommerce.checkout().canCheckout()) {
        reduxEcommerce.checkout().processCheckout();
      }
    });

    bench('store-react - ecommerce simulation', () => {
      // Clear cart for consistent state
      storeReactEcommerce.cart().clearCart();

      // Simulate shopping behavior
      for (let i = 0; i < 50; i++) {
        const productId = `prod-${Math.floor(Math.random() * 100)}`;
        storeReactEcommerce.ui().selectProduct(productId);
        storeReactEcommerce.cart().addItem(
          productId,
          Math.floor(Math.random() * 3) + 1
        );

        if (i % 10 === 0) {
          storeReactEcommerce.ui().toggleCart();
        }

        if (
          i % 5 === 0 &&
          storeReactEcommerce.cart().getItemCount() > 0
        ) {
          const cartItems = storeReactEcommerce.cart().getItemCount();
          if (cartItems > 10) {
            // Remove some items
            storeReactEcommerce.cart().removeItem(
              `prod-${Math.floor(Math.random() * 100)}`
            );
          }
        }
      }

      // Checkout if possible
      if (storeReactEcommerce.checkout().canCheckout()) {
        storeReactEcommerce.checkout().processCheckout();
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
        store.todos().addTodo(`Todo item ${i}`, tags);
      }

      // Toggle some todos as completed
      for (let i = 0; i < 50; i++) {
        const todos = store.queries().getFilteredTodos();
        const todo = todos[i]?.id;

        if (todo) store.todos().toggleTodo(todo);
      }

      return store;
    };

    const createTodoApp = (createSlice: RuntimeSliceFactory<TodoState>) => {
      const todos = createSlice(
        (selectors) => ({ todos: selectors.todos }),
        ({}, set) => ({
          addTodo: (text: string, tags: string[] = []) => {
            set(
              (selectors) => ({ todos: selectors.todos }),
              ({ todos }) => ({
                todos: [
                  ...todos(),
                  {
                    id: `todo-${Date.now()}`,
                    text,
                    completed: false,
                    tags,
                  },
                ],
              })
            );
          },
          toggleTodo: (id: string) => {
            set(
              (selectors) => ({ todos: selectors.todos }),
              ({ todos }) => ({
                todos: todos().map((todo) =>
                  todo.id === id ? { ...todo, completed: !todo.completed } : todo
                ),
              })
            );
          },
          deleteTodo: (id: string) => {
            set(
              (selectors) => ({ todos: selectors.todos }),
              ({ todos }) => ({
                todos: todos().filter((todo) => todo.id !== id),
              })
            );
          },
          updateTodo: (id: string, text: string) => {
            set(
              (selectors) => ({ todos: selectors.todos }),
              ({ todos }) => ({
                todos: todos().map((todo) =>
                  todo.id === id ? { ...todo, text } : todo
                ),
              })
            );
          },
          clearCompleted: () => {
            set(
              (selectors) => ({ todos: selectors.todos }),
              ({ todos }) => ({
                todos: todos().filter((todo) => !todo.completed),
              })
            );
          },
        })
      );

      const filters = createSlice(
        (selectors) => ({ filter: selectors.filter, searchTerm: selectors.searchTerm, selectedTags: selectors.selectedTags }),
        ({}, set) => ({
          setFilter: (newFilter: 'all' | 'active' | 'completed') => {
            set(
              (selectors) => ({ filter: selectors.filter }),
              () => ({ filter: newFilter })
            );
          },
          setSearchTerm: (term: string) => {
            set(
              (selectors) => ({ searchTerm: selectors.searchTerm }),
              () => ({ searchTerm: term })
            );
          },
          toggleTag: (tag: string) => {
            set(
              (selectors) => ({ selectedTags: selectors.selectedTags }),
              ({ selectedTags }) => {
                const selected = selectedTags();
                if (selected.includes(tag)) {
                  return { selectedTags: selected.filter((t) => t !== tag) };
                } else {
                  return { selectedTags: [...selected, tag] };
                }
              }
            );
          },
          clearFilters: () => {
            set(
              (selectors) => ({ filter: selectors.filter, searchTerm: selectors.searchTerm, selectedTags: selectors.selectedTags }),
              () => ({ filter: 'all', searchTerm: '', selectedTags: [] })
            );
          },
        })
      );

      const queries = createSlice(
        (selectors) => ({ todos: selectors.todos, filter: selectors.filter, searchTerm: selectors.searchTerm, selectedTags: selectors.selectedTags }),
        ({ todos, filter, searchTerm, selectedTags }) => ({
        getFilteredTodos: () => {
          let todoList = todos();

          // Filter by completion status
          const currentFilter = filter();
          if (currentFilter === 'active') {
            todoList = todoList.filter((t) => !t.completed);
          } else if (currentFilter === 'completed') {
            todoList = todoList.filter((t) => t.completed);
          }

          // Filter by search term
          const currentSearchTerm = searchTerm().toLowerCase();
          if (currentSearchTerm) {
            todoList = todoList.filter((t) =>
              t.text.toLowerCase().includes(currentSearchTerm)
            );
          }

          // Filter by tags
          const currentSelectedTags = selectedTags();
          if (currentSelectedTags.length > 0) {
            todoList = todoList.filter((t) =>
              currentSelectedTags.some((tag) => t.tags.includes(tag))
            );
          }

          return todoList;
        },
        getStats: () => {
          const todoList = todos();
          return {
            total: todoList.length,
            active: todoList.filter((t) => !t.completed).length,
            completed: todoList.filter((t) => t.completed).length,
          };
        },
        getAllTags: () => {
          const tags = new Set<string>();
          todos().forEach((todo) => {
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
      zustandTodo.filters().clearFilters();

      // Apply filters and get results
      zustandTodo.filters().setFilter('active');
      zustandTodo.queries().getFilteredTodos();

      zustandTodo.filters().setSearchTerm('item 1');
      zustandTodo.queries().getFilteredTodos();

      zustandTodo.filters().toggleTag('tag1');
      zustandTodo.filters().toggleTag('priority0');
      zustandTodo.queries().getFilteredTodos();

      // Get stats
      zustandTodo.queries().getStats();

      // Update some todos
      for (let i = 0; i < 20; i++) {
        const todos = zustandTodo.queries().getFilteredTodos();
        const todoId = todos[i]?.id;
        if (todoId) {
          zustandTodo.todos().updateTodo(todoId, `Updated ${i}`);
        }
      }

      // Clear completed
      zustandTodo.todos().clearCompleted();
    });

    bench('redux - todo app simulation', () => {
      // Reset filters for consistent state
      reduxTodo.filters().clearFilters();

      // Apply filters and get results
      reduxTodo.filters().setFilter('active');
      reduxTodo.queries().getFilteredTodos();

      reduxTodo.filters().setSearchTerm('item 1');
      reduxTodo.queries().getFilteredTodos();

      reduxTodo.filters().toggleTag('tag1');
      reduxTodo.filters().toggleTag('priority0');
      reduxTodo.queries().getFilteredTodos();

      // Get stats
      reduxTodo.queries().getStats();

      // Update some todos
      for (let i = 0; i < 20; i++) {
        const todos = reduxTodo.queries().getFilteredTodos();
        const todoId = todos[i]?.id;

        if (todoId) {
          reduxTodo.todos().updateTodo(todoId, `Updated ${i}`);
        }
      }

      // Clear completed
      reduxTodo.todos().clearCompleted();
    });

    bench('store-react - todo app simulation', () => {
      // Reset filters for consistent state
      storeReactTodo.filters().clearFilters();

      // Apply filters and get results
      storeReactTodo.filters().setFilter('active');
      storeReactTodo.queries().getFilteredTodos();

      storeReactTodo.filters().setSearchTerm('item 1');
      storeReactTodo.queries().getFilteredTodos();

      storeReactTodo.filters().toggleTag('tag1');
      storeReactTodo.filters().toggleTag('priority0');
      storeReactTodo.queries().getFilteredTodos();

      // Get stats
      storeReactTodo.queries().getStats();

      // Update some todos
      for (let i = 0; i < 20; i++) {
        const todos = storeReactTodo.queries().getFilteredTodos();
        const todoId = todos[i]?.id;
        if (todoId) {
          storeReactTodo.todos().updateTodo(todoId, `Updated ${i}`);
        }
      }

      // Clear completed
      storeReactTodo.todos().clearCompleted();
    });
  });
});
