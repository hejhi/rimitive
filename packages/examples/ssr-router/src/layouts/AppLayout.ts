import { connect } from '../service.js';
import { Navigation } from '../islands/Navigation.js';

export const AppLayout = connect((svc, { children }) => () => {
  const { el } = svc;
  return el('div').props({ className: 'app' })(
    el('nav').props({ className: 'navbar' })(
      el('div').props({ className: 'nav-brand' })(
        el('h1')('🧩 Lattice SSR + Router')
      ),
      Navigation({})
    ),
    el('main').props({ className: 'main-content' })(...(children || []))
  );
});
