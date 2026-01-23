import { Service } from '../service';

export const NotFound =
  ({ el, router }: Service) =>
  () =>
    el('div').props({ className: 'page not-found' })(
      el('h2')('Page Not Found'),
      el('p')('The page you are looking for does not exist.'),
      el('button').props({
        className: 'primary-btn',
        onclick: () => router.navigate('/'),
      })('← Go Home')
    );
