import { describe, it, expect } from 'vitest';
import type { ComponentContext } from './types';
import { createTestComponent, type TodoState } from '../../testing/test-utils';

describe('Component Composition', () => {
  it('should support composition', () => {
    const SubCounter = ({
      store,
      set,
    }: ComponentContext<{ subCount: number }>) => ({
      value: store.subCount,
      inc: () => set(store.subCount, store.subCount.value + 1),
    });

    const store = createTestComponent({ subCount: 5, multiplier: 3 });
    const component = ((context: typeof store) => {
      const sub = SubCounter(context);
      const total = context.computed(
        () => sub.value.value * context.store.multiplier.value
      );

      return {
        counter: sub,
        multiplier: context.store.multiplier,
        total,
        setMultiplier: (n: number) => context.set(context.store.multiplier, n),
      };
    })(store);

    expect(component.total.value).toBe(15);

    component.counter.inc();
    expect(component.total.value).toBe(18);

    component.setMultiplier(2);
    expect(component.total.value).toBe(12);
  });

  it('should properly track dependencies in computed values', () => {
    const TodoApp = ({ store, computed, set }: ComponentContext<TodoState>) => {
      const filtered = computed(() => {
        const f = store.filter.value;
        const t = store.todos.value;
        if (f === 'all') return t;
        return t.filter((todo) =>
          f === 'active' ? !todo.completed : todo.completed
        );
      });

      return {
        todos: store.todos,
        filter: store.filter,
        filtered,
        addTodo: (text: string) =>
          set(store.todos, [
            ...store.todos.value,
            {
              id: Date.now().toString(),
              text,
              completed: false,
            },
          ]),
        setFilter: (f: 'all' | 'active' | 'done') => set(store.filter, f),
      };
    };

    const store = createTestComponent<TodoState>({ todos: [], filter: 'all' });
    const component = TodoApp(store);

    component.addTodo('Buy milk');
    component.addTodo('Read book');

    // Mark second todo as completed
    const todos = component.todos.value;

    if (!todos[1]) return;

    todos[1] = { ...todos[1], completed: true };
    store.set(store.store.todos, todos);

    expect(component.filtered.value).toHaveLength(2);

    component.setFilter('active');
    expect(component.filtered.value).toHaveLength(1);
    expect(component.filtered.value[0]?.text).toBe('Buy milk');

    component.setFilter('done');
    expect(component.filtered.value).toHaveLength(1);
    expect(component.filtered.value[0]?.text).toBe('Read book');
  });

  it('should support nested components', () => {
    interface AppState {
      user: { name: string; id: string };
      settings: { theme: 'light' | 'dark'; notifications: boolean };
    }

    const UserComponent = ({
      store,
      set,
    }: ComponentContext<{ user: AppState['user'] }>) => ({
      user: store.user,
      updateName: (name: string) => set(store.user, { ...store.user.value, name }),
    });

    const SettingsComponent = ({
      store,
      set,
    }: ComponentContext<{ settings: AppState['settings'] }>) => ({
      settings: store.settings,
      toggleTheme: () =>
        set(store.settings, {
          ...store.settings.value,
          theme: store.settings.value.theme === 'light' ? 'dark' : 'light',
        }),
    });

    const store = createTestComponent<AppState>({
      user: { name: 'John', id: '123' },
      settings: { theme: 'light', notifications: true },
    });

    const app = ((context: typeof store) => {
      const user = UserComponent(context);
      const settings = SettingsComponent(context);

      return { user, settings };
    })(store);

    expect(app.user.user.value.name).toBe('John');
    expect(app.settings.settings.value.theme).toBe('light');

    app.user.updateName('Jane');
    expect(app.user.user.value.name).toBe('Jane');

    app.settings.toggleTheme();
    expect(app.settings.settings.value.theme).toBe('dark');
  });
});
