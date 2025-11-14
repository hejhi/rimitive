import { create, mount } from './api';
import { Counter } from './components/Counter';
import { TodoList } from './components/TodoList';
import { ConditionalExample } from './components/ConditionalExample';
import { TagList } from './components/TagList';

const App = create(({ el }) => () => {
  return el('div', { className: 'app' })(
    Counter(10),
    ConditionalExample(),
    TodoList(),
    el('div', { className: 'tag-list-container' })(
      el('h3')('Tag List (Fragment Component)'),
      el('div', { className: 'tag-list' })(
        TagList({ tags: ['React', 'Vue', 'Svelte', 'Solid', 'Lattice'] })
      )
    )
  )();
});

const app = mount(App());
const container = document.querySelector('#app');
container?.appendChild(app.element as Node);
