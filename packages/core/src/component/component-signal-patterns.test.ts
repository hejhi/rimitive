import { describe, it, expect } from 'vitest';
import { createStore, Store } from '../store';

describe('Component Signal Patterns - Best Practices', () => {
  it('should use direct signal updates for single property changes (performance)', () => {
    interface CounterState {
      count: number;
      lastUpdated: number;
    }

    const Counter = (store: Store<CounterState>) => {
      return {
        get count() {
          return store.state.count.value;
        },

        // BEST PRACTICE: Direct signal update for single property
        increment: () => {
          store.state.count.value++;
          store.state.lastUpdated.value = Date.now();
        },

        // BEST PRACTICE: Direct signal update
        decrement: () => {
          store.state.count.value--;
          store.state.lastUpdated.value = Date.now();
        },

        // BEST PRACTICE: Direct signal updates when order doesn't matter
        reset: () => {
          store.state.count.value = 0;
          store.state.lastUpdated.value = Date.now();
        },

        // BEST PRACTICE: Use store.set for truly batched updates
        incrementBoth: () => {
          store.set({
            count: store.state.count.value + 1,
            lastUpdated: Date.now(),
          });
        },
      };
    };

    const store = createStore<CounterState>({ count: 0, lastUpdated: 0 });
    const counter = Counter(store);

    counter.increment();
    expect(counter.count).toBe(1);

    counter.decrement();
    expect(counter.count).toBe(0);

    store.dispose();
  });

  it('should use signal.set for nested object/array updates', () => {
    interface TodoState {
      todos: Array<{ id: string; text: string; done: boolean }>;
      filter: 'all' | 'active' | 'done';
    }

    const TodoList = (store: Store<TodoState>) => {
      return {
        get todos() {
          return store.state.todos.value;
        },

        // BEST PRACTICE: Use signal.set for array element updates
        toggleTodo: (index: number) => {
          const todo = store.state.todos.value[index];
          if (todo) {
            store.state.todos.set(index, { ...todo, done: !todo.done });
          }
        },

        // BEST PRACTICE: Use signal.patch for partial updates
        updateTodoText: (index: number, text: string) => {
          store.state.todos.patch(index, { text });
        },

        // BEST PRACTICE: Direct assignment for full array replacement
        markAllDone: () => {
          store.state.todos.value = store.state.todos.value.map((todo) => ({
            ...todo,
            done: true,
          }));
        },
      };
    };

    const store = createStore<TodoState>({
      todos: [
        { id: '1', text: 'Task 1', done: false },
        { id: '2', text: 'Task 2', done: false },
      ],
      filter: 'all',
    });

    const todoList = TodoList(store);

    // Test signal.set
    todoList.toggleTodo(0);
    expect(todoList.todos[0]?.done).toBe(true);
    expect(todoList.todos[1]?.done).toBe(false);

    // Test signal.patch
    todoList.updateTodoText(1, 'Updated Task 2');
    expect(todoList.todos[1]?.text).toBe('Updated Task 2');

    // Test direct assignment
    todoList.markAllDone();
    expect(todoList.todos.every((t) => t.done)).toBe(true);

    store.dispose();
  });

  it('should support fine-grained subscriptions to individual signals', () => {
    interface FormState {
      username: string;
      email: string;
      password: string;
      confirmPassword: string;
      isValid: boolean;
    }

    const Form = (store: Store<FormState>) => {
      return {
        get username() {
          return store.state.username.value;
        },
        get email() {
          return store.state.email.value;
        },

        // BEST PRACTICE: Direct signal updates
        setUsername: (value: string) => {
          store.state.username.value = value;
        },

        setEmail: (value: string) => {
          store.state.email.value = value;
        },

        // BEST PRACTICE: Subscribe to individual signals for fine-grained reactivity
        subscribeToUsername: (fn: () => void) => {
          return store.state.username.subscribe(fn);
        },

        subscribeToEmail: (fn: () => void) => {
          return store.state.email.subscribe(fn);
        },
      };
    };

    const store = createStore<FormState>({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      isValid: false,
    });

    const form = Form(store);

    let usernameChanges = 0;
    let emailChanges = 0;

    // Subscribe to individual signals
    const unsubUsername = form.subscribeToUsername(() => {
      usernameChanges++;
    });

    const unsubEmail = form.subscribeToEmail(() => {
      emailChanges++;
    });

    // Update username - only username subscription fires
    form.setUsername('john');
    expect(usernameChanges).toBe(1);
    expect(emailChanges).toBe(0);

    // Update email - only email subscription fires
    form.setEmail('john@example.com');
    expect(usernameChanges).toBe(1);
    expect(emailChanges).toBe(1);

    // Cleanup
    unsubUsername();
    unsubEmail();

    // Further updates don't trigger subscriptions
    form.setUsername('jane');
    expect(usernameChanges).toBe(1);

    store.dispose();
  });

  it('should demonstrate performance patterns with effects', () => {
    interface DashboardState {
      activeUsers: number;
      totalRevenue: number;
      lastRefresh: number;
      refreshRate: number;
    }

    const Dashboard = (store: Store<DashboardState>) => {
      const ctx = store.getContext();

      // Effects demonstrate automatic dependency tracking
      ctx.effect(() => {
        // Accessing signals subscribes to them
        const users = store.state.activeUsers.value;
        const revenue = store.state.totalRevenue.value;
        console.log(`Metrics updated: ${users} users, $${revenue}`);
      });

      // Effect that tracks single signal
      ctx.effect(() => {
        const lastRefresh = store.state.lastRefresh.value;
        console.log(`Last refresh: ${lastRefresh}`);
      });

      return {
        get activeUsers() {
          return store.state.activeUsers.value;
        },
        get totalRevenue() {
          return store.state.totalRevenue.value;
        },

        // BEST PRACTICE: Use store.set when updating multiple related properties
        updateMetrics: (users: number, revenue: number) => {
          store.set({
            activeUsers: users,
            totalRevenue: revenue,
            lastRefresh: Date.now(),
          });
        },

        // BEST PRACTICE: Direct update for single property
        updateActiveUsers: (users: number) => {
          store.state.activeUsers.value = users;
        },

        // BEST PRACTICE: Direct updates are fine when order doesn't matter
        refresh: () => {
          store.state.lastRefresh.value = Date.now();
        },
      };
    };

    const store = createStore<DashboardState>({
      activeUsers: 0,
      totalRevenue: 0,
      lastRefresh: Date.now(),
      refreshRate: 5000,
    });

    const dashboard = Dashboard(store);

    // Batched update - effects run once
    dashboard.updateMetrics(100, 50000);

    // Single update - only relevant effect runs
    dashboard.updateActiveUsers(105);

    // Independent update - only refresh effect runs
    dashboard.refresh();

    store.dispose();
  });

  it('should use computed values with direct signal access', () => {
    interface ShoppingCartState {
      items: Array<{ id: string; price: number; quantity: number }>;
      taxRate: number;
      discountPercent: number;
    }

    const ShoppingCart = (store: Store<ShoppingCartState>) => {
      const ctx = store.getContext();

      // BEST PRACTICE: Computed values access signals directly
      const subtotal = ctx.computed(() => {
        return store.state.items.value.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
      });

      const discount = ctx.computed(() => {
        return (subtotal.value * store.state.discountPercent.value) / 100;
      });

      const tax = ctx.computed(() => {
        const taxableAmount = subtotal.value - discount.value;
        return taxableAmount * store.state.taxRate.value;
      });

      const total = ctx.computed(() => {
        return subtotal.value - discount.value + tax.value;
      });

      return {
        get items() {
          return store.state.items.value;
        },
        get subtotal() {
          return subtotal.value;
        },
        get tax() {
          return tax.value;
        },
        get discount() {
          return discount.value;
        },
        get total() {
          return total.value;
        },

        // BEST PRACTICE: Direct signal update for array append
        addItem: (item: ShoppingCartState['items'][0]) => {
          store.state.items.value = [...store.state.items.value, item];
        },

        // BEST PRACTICE: Use signal.patch for nested updates
        updateQuantity: (index: number, quantity: number) => {
          store.state.items.patch(index, { quantity });
        },

        // BEST PRACTICE: Direct updates for simple values
        setTaxRate: (rate: number) => {
          store.state.taxRate.value = rate;
        },

        setDiscount: (percent: number) => {
          store.state.discountPercent.value = percent;
        },
      };
    };

    const store = createStore<ShoppingCartState>({
      items: [
        { id: '1', price: 10, quantity: 2 },
        { id: '2', price: 20, quantity: 1 },
      ],
      taxRate: 0.08,
      discountPercent: 10,
    });

    const cart = ShoppingCart(store);

    expect(cart.subtotal).toBe(40); // (10*2) + (20*1)
    expect(cart.discount).toBe(4); // 10% of 40
    expect(cart.tax).toBe(2.88); // 8% of 36
    expect(cart.total).toBe(38.88); // 40 - 4 + 2.88

    // Add item
    cart.addItem({ id: '3', price: 15, quantity: 1 });
    expect(cart.subtotal).toBe(55);

    // Update quantity using patch
    cart.updateQuantity(0, 3);
    expect(cart.subtotal).toBe(65); // (10*3) + (20*1) + (15*1)

    // Direct updates
    cart.setDiscount(20);
    expect(cart.discount).toBe(13); // 20% of 65

    store.dispose();
  });

  it('should demonstrate select pattern for fine-grained computed tracking', () => {
    interface AppState {
      user: { name: string; role: string; lastActive: number };
      settings: { theme: string; language: string };
      notifications: number;
    }

    const App = (store: Store<AppState>) => {
      const ctx = store.getContext();

      // BEST PRACTICE: Use select for fine-grained reactivity
      const userName = store.state.user.select((u) => u.name);
      const userRole = store.state.user.select((u) => u.role);
      const theme = store.state.settings.select((s) => s.theme);

      const hasNotifications = ctx.computed(
        () => store.state.notifications.value > 0
      );

      return {
        get userName() {
          return userName.value;
        },
        get userRole() {
          return userRole.value;
        },
        get theme() {
          return theme.value;
        },
        get hasNotifications() {
          return hasNotifications.value;
        },

        // Update entire object - but subscribers to userName only react if name changed
        updateUserName: (name: string) => {
          store.state.user.value = {
            ...store.state.user.value,
            name,
            lastActive: Date.now(),
          };
        },

        updateTheme: (theme: string) => {
          store.state.settings.value = {
            ...store.state.settings.value,
            theme,
          };
        },

        clearNotifications: () => {
          store.state.notifications.value = 0;
        },
      };
    };

    const store = createStore<AppState>({
      user: { name: 'John', role: 'admin', lastActive: Date.now() },
      settings: { theme: 'light', language: 'en' },
      notifications: 5,
    });

    const app = App(store);

    let nameChanges = 0;
    let roleChanges = 0;

    // Subscribe to selected values
    const unsubName = store.state.user
      .select((u) => u.name)
      .subscribe(() => {
        nameChanges++;
      });

    const unsubRole = store.state.user
      .select((u) => u.role)
      .subscribe(() => {
        roleChanges++;
      });

    // Update name - only name subscription fires
    app.updateUserName('Jane');
    expect(nameChanges).toBe(1);
    expect(roleChanges).toBe(0); // Role didn't change

    // Update lastActive without changing name - no subscription fires
    store.state.user.value = {
      ...store.state.user.value,
      lastActive: Date.now(),
    };
    expect(nameChanges).toBe(1); // Name didn't change

    unsubName();
    unsubRole();
    store.dispose();
  });
});
