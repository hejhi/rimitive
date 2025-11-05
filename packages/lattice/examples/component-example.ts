/**
 * Example demonstrating the component composition pattern
 *
 * This file shows how to use create() and Instantiatable to build
 * components with deferred context injection.
 */

import { create, type Instantiatable } from '../src/index';

// Define a simple signal-like API for demonstration
interface Signal<T> {
  get value(): T;
  set value(v: T);
}

interface API {
  signal: <T>(initialValue: T) => Signal<T>;
}

// Example 1: Simple Counter component
const Counter = create((api: API) =>
  (initialCount = 0) => {
    const count = api.signal(initialCount);
    return {
      count,
      increment: () => { count.value = count.value + 1; },
      decrement: () => { count.value = count.value - 1; },
      reset: () => { count.value = initialCount; }
    };
  }
);

// Example 2: TodoList component
const TodoList = create((api: API) =>
  (initialTodos: string[] = []) => {
    const todos = api.signal(initialTodos);
    return {
      todos,
      add: (todo: string) => {
        todos.value = [...todos.value, todo];
      },
      remove: (index: number) => {
        todos.value = todos.value.filter((_, i) => i !== index);
      },
      clear: () => {
        todos.value = [];
      }
    };
  }
);

// Example 3: Composing components together
const App = create((api: API) => () => {
  // Components are instantiated with the same context
  const counter = Counter(0).create(api);
  const todoList = TodoList(['Learn Lattice', 'Build app']).create(api);

  return {
    counter,
    todoList,
    // App-level methods
    resetAll: () => {
      counter.reset();
      todoList.clear();
    }
  };
});

// Usage demonstration
function demonstrateUsage() {
  // Mock signal implementation
  function createSignal<T>(initialValue: T): Signal<T> {
    let _value = initialValue;
    return {
      get value() { return _value; },
      set value(v: T) { _value = v; }
    };
  }

  // Create the API context
  const api: API = {
    signal: createSignal
  };

  // Create component definitions (no instantiation yet)
  const counterDef = Counter(10);
  const todoDef = TodoList(['First task']);

  // Type checks
  const _c: Instantiatable<ReturnType<typeof Counter extends (...args: never[]) => infer R ? R extends Instantiatable<infer T, never> ? () => T : never : never>, API> = counterDef;

  // Instantiate with context
  const counter = counterDef.create(api);
  const todoList = todoDef.create(api);

  console.log('Counter initial value:', counter.count.value); // 10
  counter.increment();
  console.log('Counter after increment:', counter.count.value); // 11

  console.log('TodoList initial:', todoList.todos.value); // ['First task']
  todoList.add('Second task');
  console.log('TodoList after add:', todoList.todos.value); // ['First task', 'Second task']

  // Instantiate composed app
  const app = App().create(api);
  console.log('App counter:', app.counter.count.value); // 0
  console.log('App todos:', app.todoList.todos.value); // ['Learn Lattice', 'Build app']
}

// This is just an example file for documentation
export { demonstrateUsage, Counter, TodoList, App };
