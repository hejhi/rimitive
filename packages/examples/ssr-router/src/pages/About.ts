import type { Service } from '../service.js';
import type { ElRefSpecChild } from '@rimitive/view/types';

/**
 * Shadow DOM Card Component
 *
 * Demonstrates Declarative Shadow DOM (DSD) for SSR.
 * - Server renders: <template shadowrootmode="open">...</template>
 * - Browser automatically upgrades to real shadow root
 * - Client hydrates without re-creating content
 */
const ShadowCard =
  ({ el, shadow }: Service) =>
  (title: string, ...children: ElRefSpecChild[]) => {
    const styles = `
      :host {
        display: block;
        margin: 1rem 0;
      }
      .card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
      }
      .card h4 {
        margin: 0 0 0.75rem 0;
        font-size: 1.25rem;
      }
      .card p {
        margin: 0;
        opacity: 0.9;
        line-height: 1.6;
      }
    `;

    return el('shadow-card')(
      shadow({ mode: 'open', styles })(
        el('div').props({ className: 'card' })(el('h4')(title), ...children)
      )
    );
  };

export const About = (svc: Service) => () => {
  const { el } = svc;
  const Card = ShadowCard(svc);

  return el('div').props({ className: 'page about-page' })(
    el('h2')('About Us'),
    el('p').props({ className: 'lead' })(
      'We build tools that help developers create faster, more reliable web applications.'
    ),

    el('section').props({ className: 'card' })(
      el('h3')('Our Mission'),
      el('p')(
        'To simplify web development by providing reactive primitives and modules that work everywhere. ' +
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

    // Shadow DOM Demo
    el('section').props({ className: 'card' })(
      el('h3')('Shadow DOM Demo'),
      el('p')(
        'The purple card below uses Declarative Shadow DOM (DSD). ' +
          'Its styles are encapsulated and cannot leak to or from the page.'
      ),
      Card(
        'Encapsulated Component',
        el('p')(
          'This card has its own scoped styles via shadow DOM. ' +
            'The gradient background and styling come from the shadow root, ' +
            'completely isolated from the page CSS.'
        )
      ),
      el('p').props({
        style: 'margin-top: 1rem; font-size: 0.875rem; opacity: 0.7;',
      })(
        'View page source to see the <template shadowrootmode="open"> in the HTML.'
      )
    ),

    el('section').props({ className: 'card' })(
      el('h3')('This Page'),
      el('p')(
        'This about page is rendered on the server using basic sync SSR. ' +
          'The shadow DOM content is serialized as Declarative Shadow DOM and ' +
          'automatically upgraded by the browser during HTML parsing.'
      )
    )
  );
};
