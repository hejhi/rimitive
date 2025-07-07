import { describe, it, expect, beforeEach } from 'vitest';
import { resetGlobalState } from './test-setup';
import { signal, computed } from './index';

describe('select', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should only trigger when selected value changes', () => {
    const todos = signal([
      { id: 1, text: 'Task 1', done: false },
      { id: 2, text: 'Task 2', done: false },
      { id: 3, text: 'Task 3', done: false }
    ]);

    let subscribeCount = 0;
    
    // Select only the second todo
    const secondTodo = todos.select(todos => todos[1]);
    
    secondTodo.subscribe(() => {
      subscribeCount++;
    });
    
    // Update first todo - should NOT trigger
    const newTodos1 = [...todos.value];
    newTodos1[0] = { id: 1, text: 'Task 1', done: true };
    todos.value = newTodos1;
    expect(subscribeCount).toBe(0);
    
    // Update second todo - SHOULD trigger
    const newTodos2 = [...todos.value];
    newTodos2[1] = { id: 2, text: 'Task 2', done: true };
    todos.value = newTodos2;
    expect(subscribeCount).toBe(1);
    
    // Update third todo - should NOT trigger
    const newTodos3 = [...todos.value];
    newTodos3[2] = { id: 3, text: 'Task 3', done: true };
    todos.value = newTodos3;
    expect(subscribeCount).toBe(1);
  });

  it('should work with nested selectors', () => {
    const state = signal({
      user: { name: 'John', age: 30, settings: { theme: 'dark' } },
      todos: []
    });

    let nameCount = 0;
    let themeCount = 0;
    
    // Select specific nested values
    const userName = state.select(s => s.user.name);
    const userTheme = state.select(s => s.user.settings.theme);
    
    userName.subscribe(() => nameCount++);
    userTheme.subscribe(() => themeCount++);
    
    // Update name - only name subscription fires
    state.value = {
      ...state.value,
      user: { ...state.value.user, name: 'Jane' }
    };
    expect(nameCount).toBe(1);
    expect(themeCount).toBe(0);
    
    // Update theme - only theme subscription fires
    state.value = {
      ...state.value,
      user: { 
        ...state.value.user, 
        settings: { theme: 'light' } 
      }
    };
    expect(nameCount).toBe(1);
    expect(themeCount).toBe(1);
  });

  it('should support computed values with select', () => {
    const todo1 = { id: 1, text: 'Task 1', done: false };
    const todo2 = { id: 2, text: 'Task 2', done: true };
    const todo3 = { id: 3, text: 'Task 3', done: false };
    
    const todosSignal = signal([todo1, todo2, todo3]);

    // Computed that filters done todos
    const doneTodos = computed(() => 
      todosSignal.value.filter(t => t.done)
    );
    
    let firstDoneCount = 0;
    
    // Select the first done todo
    const firstDone = doneTodos.select(done => done[0]);
    firstDone.subscribe(() => firstDoneCount++);
    
    // Initially, todo2 is the first done todo
    expect(firstDone.value).toBe(todo2);
    
    // Mark first todo as done - should trigger (different first done todo)
    const todo1Done = { ...todo1, done: true };
    todosSignal.value = [todo1Done, todo2, todo3];
    expect(firstDoneCount).toBe(1);
    expect(firstDone.value).toBe(todo1Done); // Now todo1 is first done
    
    // Update todo3 - should NOT trigger (first done todo still todo1Done)
    const todo3Updated = { ...todo3, text: 'Task 3 Updated' };
    todosSignal.value = [todo1Done, todo2, todo3Updated];
    expect(firstDoneCount).toBe(1); // No change to first done todo
  });

  it('should use reference equality for comparison', () => {
    const state = signal({
      config: { theme: 'dark', fontSize: 14 }
    });

    let configCount = 0;
    const config = state.select(s => s.config);
    config.subscribe(() => configCount++);
    
    // Same object reference - no trigger
    state.value = { ...state.value, config: state.value.config };
    expect(configCount).toBe(0);
    
    // New object with same values - DOES trigger
    state.value = { ...state.value, config: { theme: 'dark', fontSize: 14 } };
    expect(configCount).toBe(1);
  });
  
  it('chained selects should work', () => {
    const state = signal({
      users: [
        { id: 1, name: 'John', role: { type: 'admin', level: 1 } },
        { id: 2, name: 'Jane', role: { type: 'user', level: 0 } }
      ]
    });

    let levelCount = 0;
    
    // Chain selects for deep nesting
    const firstUserLevel = state
      .select(s => s.users[0])
      .select(u => u?.role.level);
      
    firstUserLevel.subscribe(() => levelCount++);
    
    // Update first user's level
    const users = [...state.value.users];
    users[0] = { ...users[0]!, role: { ...users[0]!.role, level: 2 } };
    state.value = { ...state.value, users };
    
    expect(levelCount).toBe(1);
    expect(firstUserLevel.value).toBe(2);
  });
});