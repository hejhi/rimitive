import { createComponent } from '../src/component/component';
import type { ComponentContext } from '../src/component/types';

// Common test state types
export interface CounterState {
  count: number;
}

export interface NamedCounterState extends CounterState {
  name: string;
}

export interface TodoState {
  todos: Array<{ id: string; text: string; completed: boolean }>;
  filter: 'all' | 'active' | 'done';
}

export interface UserState {
  id: string;
  name: string;
  email: string;
  active: boolean;
  lastSeen: number;
}

// Factory functions for creating test components
export function createTestComponent<State extends object>(initialState: State) {
  return createComponent(initialState);
}

// Common test components
export const CounterComponent = ({
  store,
  set,
}: ComponentContext<CounterState>) => ({
  count: store.count,
  increment: () => set(store.count, store.count() + 1),
  reset: () => set(store.count, 0),
});

export const NamedCounterComponent = ({
  store,
  computed,
  set,
}: ComponentContext<NamedCounterState>) => {
  const doubled = computed(() => store.count() * 2);

  return {
    count: store.count,
    name: store.name,
    doubled,
    increment: () => set(store.count, store.count() + 1),
    reset: () => set(store.count, 0),
    setName: (n: string) => set(store.name, n),
  };
};

// Test data generators
export function generateTodos(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `todo-${i}`,
    text: `Task ${i}`,
    completed: false,
  }));
}

export function generateUsers(count: number): UserState[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `user-${i}`,
    name: `User ${i}`,
    email: `user${i}@example.com`,
    active: i % 2 === 0,
    lastSeen: Date.now() - i * 1000,
  }));
}
