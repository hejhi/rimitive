import type { Service } from '../service';

export const NotFound =
  ({ el, router }: Service) =>
  () => {
    const { navigate } = router;
    return el('div').props({ className: 'page not-found' })(
      el('div').props({ className: 'not-found-content' })(
        el('h1').props({ className: 'not-found-title' })('404'),
        el('h2')('Page Not Found'),
        el('p')('The page you are looking for does not exist.'),
        el('button').props({
          className: 'primary-btn',
          onclick: () => navigate('/'),
        })('Go Home')
      )
    );
  };
