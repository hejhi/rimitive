import { mount } from '@lattice/view/dom';
import { create, type LatticeViewAPI } from '@lattice/view/component';
import { Counter } from './components/Counter';
import { TodoList } from './components/TodoList';
import { ConditionalExample } from './components/ConditionalExample';

const App = create(({ el }: LatticeViewAPI<HTMLElement>) => () => {
  return el('div', { className: 'app' })(
    Counter(10),
    ConditionalExample(),
    TodoList()
  )();
});

mount('#app', App());
