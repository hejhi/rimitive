import { createStore } from '../src/store';
import type { ComponentContext } from '../src/component/component-types';

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
export function createTestComponent<State extends object>(
  initialState: State
): ComponentContext<State> {
  const store = createStore(initialState);
  const ctx = store.getContext();
  return { ...ctx, store: store.state, set: store.set };
}

// Common test components
export const CounterComponent = ({
  store,
}: ComponentContext<CounterState>) => ({
  count: store.count,
  increment: () => store.count.value = store.count.value + 1,
  reset: () => store.count.value = 0,
});

export const NamedCounterComponent = ({
  store,
  computed,
}: ComponentContext<NamedCounterState>) => {
  const doubled = computed(() => store.count.value * 2);

  return {
    count: store.count,
    name: store.name,
    doubled,
    increment: () => store.count.value = store.count.value + 1,
    reset: () => store.count.value = 0,
    setName: (n: string) => store.name.value = n,
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
