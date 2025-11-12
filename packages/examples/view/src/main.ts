import { create, mount } from './api';
import { Counter } from './components/Counter';
import { TodoList } from './components/TodoList';
import { ConditionalExample } from './components/ConditionalExample';

const App = create(({ el }) => () => {
  return el('div', { className: 'app' })(
    Counter(10),
    ConditionalExample(),
    TodoList()
  )();
});

const app = mount(App());
const container = document.querySelector('#app');
container?.appendChild(app.element!);
