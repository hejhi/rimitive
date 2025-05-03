import { describe, it, expect } from 'vitest';
import { createAPI } from '../index';
import { withStoreSync } from '../index';

describe('createAPI', () => {
  it('should create an API store with proper state management', () => {
    interface TodoState {
      todos: string[];
      addTodo: (todo: string) => void;
      removeTodo: (index: number) => void;
      getTodos: () => string[];
    }

    const { api, hooks } = createAPI<TodoState>((set, get) => ({
      todos: [],
      addTodo: (todo) => set((state) => ({ todos: [...state.todos, todo] })),
      removeTodo: (index) =>
        set((state) => ({
          todos: state.todos.filter((_, i) => i !== index),
        })),
      getTodos: () => get().todos,
    }));

    // Test initial state
    expect(api.getState().todos).toEqual([]);

    // Test adding todos
    api.getState().addTodo('Learn TypeScript');
    api.getState().addTodo('Write tests');
    expect(api.getState().todos).toEqual(['Learn TypeScript', 'Write tests']);

    // Test getting todos
    expect(api.getState().getTodos()).toEqual([
      'Learn TypeScript',
      'Write tests',
    ]);

    // Test removing todo
    api.getState().removeTodo(0);
    expect(api.getState().todos).toEqual(['Write tests']);

    // Verify hooks interface
    expect(hooks).toBeDefined();
    expect(typeof hooks.before).toBe('function');
    expect(typeof hooks.after).toBe('function');
  });

  it('should execute hooks with proper argument and return value handling', () => {
    interface MathState {
      calculate: (a: number, b: number) => number;
      formatResult: (result: number) => string;
    }

    const { api, hooks } = createAPI<MathState>((_set, _get) => ({
      calculate: (a, b) => a + b,
      formatResult: (result) => `Result: ${result}`,
    }));

    // Test before hook modifying first argument
    hooks.before('calculate', (a: number, _b: number) => a * 2);

    // Test after hook modifying return value
    hooks.after('calculate', (result: number) => result * 2);

    // Test format hook
    hooks.before('formatResult', (result: number) => result + 1);

    const result = api.getState().calculate(2, 3);
    // (2 * 2 + 3) * 2 = 14
    expect(result).toBe(14);

    const formatted = api.getState().formatResult(10);
    // Result: 11 (10 + 1 from before hook)
    expect(formatted).toBe('Result: 11');
  });

  it('should properly integrate with withStoreSync for complex state management', () => {
    // User store
    interface UserState {
      name: string;
      email: string;
      setName: (name: string) => void;
      setEmail: (email: string) => void;
    }

    // Settings store
    interface SettingsState {
      theme: 'light' | 'dark';
      language: string;
      setTheme: (theme: 'light' | 'dark') => void;
      setLanguage: (lang: string) => void;
    }

    // Create source stores
    const userStore = createAPI<UserState>((set) => ({
      name: 'John',
      email: 'john@example.com',
      setName: (name) => set({ name }),
      setEmail: (email) => set({ email }),
    }));

    const settingsStore = createAPI<SettingsState>((set) => ({
      theme: 'light',
      language: 'en',
      setTheme: (theme) => set({ theme }),
      setLanguage: (lang) => set({ language: lang }),
    }));

    const stores = {
      user: userStore.api,
      settings: settingsStore.api,
    } as const;

    // Target store that combines and processes data from source stores
    interface TargetState {
      getFormattedUser: () => string;
      getThemedEmail: () => string;
      updateUserTheme: (theme: 'light' | 'dark') => void;
    }

    const { api } = createAPI<TargetState>(
      withStoreSync(stores, (state) => ({
        syncedName: state.user.name,
        syncedEmail: state.user.email,
        syncedTheme: state.settings.theme,
      }))((_set, get) => ({
        getFormattedUser: () => `${get().syncedName} (${get().syncedEmail})`,
        getThemedEmail: () => `${get().syncedEmail} [${get().syncedTheme}]`,
        updateUserTheme: (theme) =>
          settingsStore.api.getState().setTheme(theme),
      }))
    );

    // Test initial synced state
    expect(api.getState().getFormattedUser()).toBe('John (john@example.com)');
    expect(api.getState().getThemedEmail()).toBe('john@example.com [light]');

    // Test state updates propagation
    userStore.api.getState().setName('Jane');
    userStore.api.getState().setEmail('jane@example.com');
    settingsStore.api.getState().setTheme('dark');

    expect(api.getState().getFormattedUser()).toBe('Jane (jane@example.com)');
    expect(api.getState().getThemedEmail()).toBe('jane@example.com [dark]');

    // Test method that updates source store
    api.getState().updateUserTheme('light');
    expect(api.getState().getThemedEmail()).toBe('jane@example.com [light]');
  });
});
