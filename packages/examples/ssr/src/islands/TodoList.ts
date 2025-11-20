/**
 * TodoList Island - Interactive todo list
 */
import { island } from '@lattice/islands/island';
import { use } from '../api.js';

export const TodoList = island(
  'todolist',
  use(
    ({ el, signal, computed, map }) =>
      ({ initialTodos }: { initialTodos: string[] }) => {
        const todos = signal(initialTodos);
        const input = signal('');

        const addTodo = () => {
          const value = input();
          if (value.trim()) {
            todos([...todos(), value]);
            input('');
          }
        };

        return el('div', { className: 'todo-list' })(
          el('h2')('Todo List Island'),
          el('div', { className: 'add-todo' })(
            el('input', {
              type: 'text',
              placeholder: 'Add a todo...',
              value: computed(() => input()),
              oninput: (e: Event) =>
                input((e.target as HTMLInputElement).value),
              onkeydown: (e: KeyboardEvent) => {
                if (e.key === 'Enter') addTodo();
              },
            })(),
            el('button', { onclick: addTodo })('Add')
          ),
          el('ul')(map(todos)((todo) => el('li')(todo)))
        );
      }
  )
);
