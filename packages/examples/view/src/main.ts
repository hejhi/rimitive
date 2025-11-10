import { mount } from '@lattice/view/dom';
import { create } from './create';
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

mount('#app', App());
