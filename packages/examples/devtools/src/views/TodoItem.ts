/**
 * TodoItem View Component
 *
 * Renders an individual todo item with checkbox and completion styling.
 */
import type { Service } from '../service';
import type { Todo } from '../behaviors/useTodoList';

type TodoItemProps = {
  todo: () => Todo;
  toggleTodo: (id: number) => void;
};

export const TodoItem =
  (svc: Service) =>
  ({ todo, toggleTodo }: TodoItemProps) => {
    const { el, computed } = svc;

    const isCompleted = computed(() => todo().completed);

    return el('li').props({
      className: computed(() =>
        isCompleted() ? 'todo-item completed' : 'todo-item'
      ),
    })(
      el('input').props({
        type: 'checkbox',
        checked: isCompleted,
        onchange: () => toggleTodo(todo().id),
      })(),
      el('span')(computed(() => todo().text))
    );
  };
