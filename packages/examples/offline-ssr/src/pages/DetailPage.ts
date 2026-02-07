import {
  getList,
  getItemsByList,
  type TodoList,
  type TodoItem as TodoItemType,
} from '../data';
import type { PageService } from './types';
import { TodoItem } from '../components/TodoItem';
import { AddItemForm } from '../components/AddItemForm';
import { EmptyState } from '../components/EmptyState';

export type DetailPageData = {
  list: TodoList;
  items: TodoItemType[];
};

export const DetailPage = (svc: PageService) => {
  const { el, signal, map, computed, router, actions, cache } = svc;
  const div = el('div');
  const h1 = el('h1');
  const button = el('button');
  const span = el('span');

  const todoItem = TodoItem(svc);
  const addItemForm = AddItemForm(svc);
  const emptyState = EmptyState(svc);

  return (params: { id: string }) =>
    cache(
      `/list/${params.id}`,
      async () => {
        const list = await getList(params.id);
        if (!list) throw new Error(`List not found: ${params.id}`);
        const items = await getItemsByList(params.id);
        return { list, items };
      },
      (data: DetailPageData) => {
        const listId = data.list.id;
        const items = signal(data.items);

        const completedCount = computed(
          () => items().filter((i) => i.completed).length
        );
        const totalCount = computed(() => items().length);

        const handleAdd = (text: string) => {
          const optimistic: TodoItemType = {
            id: crypto.randomUUID(),
            listId,
            text,
            completed: false,
            createdAt: Date.now(),
          };
          items([...items(), optimistic]);
          actions.createItem(listId, text);
        };

        const handleToggle = (id: string) => {
          items(
            items().map((i) =>
              i.id === id ? { ...i, completed: !i.completed } : i
            )
          );
          actions.toggleItem(listId, id);
        };

        const handleDelete = (id: string) => {
          items(items().filter((i) => i.id !== id));
          actions.deleteItem(listId, id);
        };

        const handleBack = () => {
          router.navigate('/', 'back');
        };

        const progress = computed(() =>
          totalCount() > 0 ? (completedCount() / totalCount()) * 100 : 0
        );

        return div.props({ className: 'page detail-page' })(
          div.props({ className: 'header' })(
            button.props({
              className: 'back-btn',
              onclick: handleBack,
            })('←'),
            div.props({ className: 'header-content' })(
              h1(data.list.name),
              span.props({ className: 'progress' })(
                () => `${completedCount()}/${totalCount()}`
              )
            )
          ),
          div.props({ className: 'detail-progress-bar' })(
            div.props({
              className: 'detail-progress-fill',
              style: () =>
                `width: ${progress()}%; background: ${data.list.color}`,
            })()
          ),

          addItemForm({ color: data.list.color, onAdd: handleAdd }),

          div.props({ className: 'items' })(
            map(
              items,
              (i) => i.id,
              (itemSig) =>
                todoItem({
                  item: itemSig,
                  onToggle: handleToggle,
                  onDelete: handleDelete,
                })
            )
          ),

          emptyState({
            visible: () => items().length === 0,
            message: 'No items yet',
            hint: 'Add your first todo above',
          })
        );
      }
    );
};
