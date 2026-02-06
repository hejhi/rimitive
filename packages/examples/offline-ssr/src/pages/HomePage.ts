import { getListsWithStats, type TodoListWithStats } from '../data';
import type { PageService } from './types';
import { ListCard } from '../components/ListCard';
import { NewListForm } from '../components/NewListForm';
import { EmptyState } from '../components/EmptyState';

export type HomePageData = {
  lists: TodoListWithStats[];
};

export const HomePage = (svc: PageService) => {
  const { el, signal, map, router, actions, cache } = svc;
  const div = el('div');
  const h1 = el('h1');
  const button = el('button');

  const listCard = ListCard(svc);
  const newListForm = NewListForm(svc);
  const emptyState = EmptyState(svc);

  return cache(
    '/',
    async () => ({ lists: await getListsWithStats() }),
    (data: HomePageData) => {
      const lists = signal(data.lists);
      const showForm = signal(false);

      const handleDelete = async (id: string) => {
        lists(lists().filter((l) => l.id !== id));
        await actions.deleteList(id);
      };

      const handleCreate = async (name: string, color: string) => {
        showForm(false);
        const list = await actions.createList(name, color);
        lists([
          ...lists(),
          { ...list, itemCount: 0, completedCount: 0, preview: [] },
        ]);
      };

      const handleNavigate = (route: string) => {
        router.navigate(route, 'forward');
      };

      return div.props({ className: 'page home-page' })(
        div.props({ className: 'header' })(
          h1('My Lists'),
          button.props({
            className: 'add-btn',
            onclick: () => showForm(!showForm()),
          })('+')
        ),

        newListForm({ visible: showForm, onCreate: handleCreate }),

        div.props({ className: 'lists' })(
          map(
            lists,
            (l) => l.id,
            (listSig) =>
              listCard({
                list: listSig(),
                onNavigate: handleNavigate,
                onDelete: handleDelete,
              })
          )
        ),

        emptyState({
          visible: () => lists().length === 0,
          message: 'No lists yet',
          hint: 'Tap + to create one',
        })
      );
    }
  );
};
