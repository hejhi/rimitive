import { Link } from '@rimitive/router/link';
import type { Service } from '../service.js';

// Static service details - all content is known at build time
const serviceDetails: Record<
  string,
  {
    name: string;
    icon: string;
    description: string;
    benefits: string[];
    process: string[];
  }
> = {
  consulting: {
    name: 'Technical Consulting',
    icon: '💡',
    description:
      'Our consulting services help you make informed technical decisions. We review your architecture, identify bottlenecks, and provide actionable recommendations.',
    benefits: [
      'Objective third-party perspective',
      'Industry best practices',
      'Reduced technical debt',
      'Faster time to market',
    ],
    process: [
      'Initial discovery call',
      'Architecture review',
      'Written recommendations',
      'Implementation support',
    ],
  },
  development: {
    name: 'Custom Development',
    icon: '🛠️',
    description:
      'We build web applications that are fast, maintainable, and scalable. Our team specializes in modern JavaScript/TypeScript with a focus on developer experience.',
    benefits: [
      'Clean, tested code',
      'Documentation included',
      'Knowledge transfer',
      'Ongoing support options',
    ],
    process: [
      'Requirements gathering',
      'Technical planning',
      'Iterative development',
      'Deployment & handoff',
    ],
  },
  training: {
    name: 'Team Training',
    icon: '📚',
    description:
      'Level up your engineering team with hands-on workshops and courses. We cover modern web development practices, reactive patterns, and performance optimization.',
    benefits: [
      'Customized curriculum',
      'Real-world examples',
      'Interactive exercises',
      'Follow-up materials',
    ],
    process: [
      'Skills assessment',
      'Custom curriculum',
      'Hands-on sessions',
      'Practice projects',
    ],
  },
};

export const ServiceDetail = (
  { el }: Service,
  { params }: { params: { id: string } }
) => {
  const service = serviceDetails[params.id];

  if (!service) {
    return el('div').props({ className: 'page not-found' })(
      el('h2')('Service Not Found'),
      el('p')('The requested service does not exist.'),
      Link({ href: '/services' })('← Back to Services')
    );
  }

  return el('div').props({ className: 'page service-detail-page' })(
    Link({ href: '/services', className: 'back-link' })('← Back to Services'),

    el('header').props({ className: 'service-header' })(
      el('span').props({ className: 'service-icon-large' })(service.icon),
      el('h2')(service.name)
    ),

    el('p').props({ className: 'service-description' })(service.description),

    el('section').props({ className: 'service-section' })(
      el('h3')('Benefits'),
      el('ul').props({ className: 'benefits-list' })(
        ...service.benefits.map((benefit) => el('li')(benefit))
      )
    ),

    el('section').props({ className: 'service-section' })(
      el('h3')('Our Process'),
      el('ol').props({ className: 'process-list' })(
        ...service.process.map((step) => el('li')(step))
      )
    ),

    el('section').props({ className: 'service-cta' })(
      el('p')('Interested in this service?'),
      Link({ href: '/contact', className: 'primary-btn' })('Contact Us')
    )
  );
};
