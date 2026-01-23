import { Link } from '@rimitive/router/link';
import type { Service } from '../service.js';

// Static service data - no database needed for a marketing site
const services = [
  {
    id: 'consulting',
    name: 'Technical Consulting',
    description: 'Architecture reviews, performance audits, and best practices guidance.',
    icon: '💡',
  },
  {
    id: 'development',
    name: 'Custom Development',
    description: 'Full-stack web applications built with modern, maintainable code.',
    icon: '🛠️',
  },
  {
    id: 'training',
    name: 'Team Training',
    description: 'Workshops and courses to level up your engineering team.',
    icon: '📚',
  },
];

export const Services =
  ({ el }: Service) =>
  () =>
    el('div').props({ className: 'page services-page' })(
      el('h2')('Our Services'),
      el('p').props({ className: 'lead' })(
        'We help teams build better web applications.'
      ),

      el('div').props({ className: 'services-grid' })(
        ...services.map((service) =>
          el('article').props({ className: 'service-card' })(
            el('span').props({ className: 'service-icon' })(service.icon),
            el('h3')(service.name),
            el('p')(service.description),
            Link({ href: `/services/${service.id}`, className: 'service-link' })(
              'Learn more →'
            )
          )
        )
      )
    );
