import { describe, it, expect, vi } from 'vitest';
import { create } from 'zustand';
import { createModel } from '../model';
import { withStoreSubscribe } from '../state';

describe('Action Parameters', () => {
  it('correctly passes parameters from actions to model methods', () => {
    // Create a test store for a todo list
    interface Todo {
      id: number;
      text: string;
      completed: boolean;
    }

    interface TodoState {
      todos: Todo[];
    }

    const todoStore = create<TodoState>(() => ({
      todos: [],
    }));

    // Create a subscriber
    const subscriber = withStoreSubscribe(todoStore, (state) => ({
      todos: state.todos,
    }));

    // Create model with methods that accept parameters
    const { model } = createModel(subscriber)((_set, _get, selectedState) => ({
      getTodos: () => selectedState.todos,

      addTodo: (text: string) => {
        todoStore.setState((state) => ({
          todos: [
            ...state.todos,
            {
              id: state.todos.length + 1,
              text,
              completed: false,
            },
          ],
        }));
      },

      toggleTodo: (id: number) => {
        todoStore.setState((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
          ),
        }));
      },

      updateTodoText: (id: number, text: string) => {
        todoStore.setState((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id ? { ...todo, text } : todo
          ),
        }));
      },

      deleteTodo: (id: number) => {
        todoStore.setState((state) => ({
          todos: state.todos.filter((todo) => todo.id !== id),
        }));
      },
    }));

    // Spy on model methods that take parameters
    const addTodoSpy = vi.spyOn(model, 'addTodo');
    const toggleTodoSpy = vi.spyOn(model, 'toggleTodo');
    const updateTodoTextSpy = vi.spyOn(model, 'updateTodoText');
    const deleteTodoSpy = vi.spyOn(model, 'deleteTodo');

    // Create actions that pass parameters to model methods
    const actions = {
      addTodo: (text: string) => model.addTodo(text),
      toggleTodo: (id: number) => model.toggleTodo(id),
      updateTodoText: (id: number, text: string) =>
        model.updateTodoText(id, text),
      deleteTodo: (id: number) => model.deleteTodo(id),
    };

    // Test adding a todo with parameter
    actions.addTodo('Buy milk');
    expect(addTodoSpy).toHaveBeenCalledWith('Buy milk');
    expect(model.getTodos()).toEqual([
      { id: 1, text: 'Buy milk', completed: false },
    ]);

    // Add another todo
    actions.addTodo('Walk the dog');
    expect(addTodoSpy).toHaveBeenCalledWith('Walk the dog');
    expect(model.getTodos()).toEqual([
      { id: 1, text: 'Buy milk', completed: false },
      { id: 2, text: 'Walk the dog', completed: false },
    ]);

    // Test toggling a todo with parameter
    actions.toggleTodo(1);
    expect(toggleTodoSpy).toHaveBeenCalledWith(1);
    expect(model.getTodos()[0]?.completed).toBe(true);

    // Test updating todo text with multiple parameters
    actions.updateTodoText(2, 'Take dog to park');
    expect(updateTodoTextSpy).toHaveBeenCalledWith(2, 'Take dog to park');
    expect(model.getTodos()[1]?.text).toBe('Take dog to park');

    // Test deleting a todo with parameter
    actions.deleteTodo(1);
    expect(deleteTodoSpy).toHaveBeenCalledWith(1);
    expect(model.getTodos().length).toBe(1);
    expect(model.getTodos()[0]?.id).toBe(2);
  });

  it('handles event objects as parameters to actions', () => {
    // Create a test store
    const formStore = create(() => ({
      firstName: '',
      lastName: '',
      email: '',
    }));

    // Create a subscriber
    const subscriber = withStoreSubscribe(formStore, (state) => state);

    // Create model with methods for form inputs
    const { model } = createModel(subscriber)((_set, _get, selectedState) => ({
      getFirstName: () => selectedState.firstName,
      getLastName: () => selectedState.lastName,
      getEmail: () => selectedState.email,

      setFirstName: (value: string) => {
        formStore.setState({ firstName: value });
      },

      setLastName: (value: string) => {
        formStore.setState({ lastName: value });
      },

      setEmail: (value: string) => {
        formStore.setState({ email: value });
      },
    }));

    // Spy on model methods
    const setFirstNameSpy = vi.spyOn(model, 'setFirstName');
    const setLastNameSpy = vi.spyOn(model, 'setLastName');
    const setEmailSpy = vi.spyOn(model, 'setEmail');

    // Create actions that extract values from event objects
    const actions = {
      handleFirstNameChange: (e: { target: { value: string } }) =>
        model.setFirstName(e.target.value),

      handleLastNameChange: (e: { target: { value: string } }) =>
        model.setLastName(e.target.value),

      handleEmailChange: (e: { target: { value: string } }) =>
        model.setEmail(e.target.value),
    };

    // Mock event objects
    const firstNameEvent = { target: { value: 'John' } };
    const lastNameEvent = { target: { value: 'Doe' } };
    const emailEvent = { target: { value: 'john.doe@example.com' } };

    // Test passing event objects to actions
    actions.handleFirstNameChange(firstNameEvent);
    expect(setFirstNameSpy).toHaveBeenCalledWith('John');
    expect(model.getFirstName()).toBe('John');

    actions.handleLastNameChange(lastNameEvent);
    expect(setLastNameSpy).toHaveBeenCalledWith('Doe');
    expect(model.getLastName()).toBe('Doe');

    actions.handleEmailChange(emailEvent);
    expect(setEmailSpy).toHaveBeenCalledWith('john.doe@example.com');
    expect(model.getEmail()).toBe('john.doe@example.com');
  });
});
