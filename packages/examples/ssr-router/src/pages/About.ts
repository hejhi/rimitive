import type { Service } from '../service.js';

export const About =
  ({ el }: Service) =>
  () =>
    el('div').props({ className: 'page about-page' })(
      el('h2')('About Us'),
      el('p').props({ className: 'lead' })(
        'We build tools that help developers create faster, more reliable web applications.'
      ),

      el('section').props({ className: 'card' })(
        el('h3')('Our Mission'),
        el('p')(
          'To simplify web development by providing powerful primitives that work everywhere. ' +
          'We believe in server-first rendering with progressive enhancement.'
        )
      ),

      el('section').props({ className: 'card' })(
        el('h3')('Our Approach'),
        el('ul')(
          el('li')('Ship HTML, not JavaScript'),
          el('li')('Add interactivity only where needed'),
          el('li')('Same code on server and client'),
          el('li')('No framework lock-in')
        )
      ),

      el('section').props({ className: 'card' })(
        el('h3')('This Page'),
        el('p')(
          'This about page is rendered on the server using basic sync SSR. ' +
          'The content is static — no async data fetching required. ' +
          'This is the simplest form of server rendering.'
        )
      )
    );
