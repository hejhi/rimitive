import type { Service } from '../service.js';

export const Home =
  ({ el, router }: Service) =>
  () =>
    el('div').props({ className: 'page home-page' })(
      el('section').props({ className: 'hero' })(
        el('h1')('Build Faster with Rimitive'),
        el('p').props({ className: 'lead' })(
          'A reactive primitives library for building performant web applications.'
        ),
        el('div').props({ className: 'hero-cta' })(
          el('button').props({
            className: 'primary-btn',
            onclick: () => router.navigate('/services'),
          })('Our Services'),
          el('button').props({
            className: 'secondary-btn',
            onclick: () => router.navigate('/contact'),
          })('Get in Touch')
        )
      ),

      el('section').props({ className: 'features' })(
        el('h2')('Why Choose Us'),
        el('div').props({ className: 'feature-grid' })(
          el('div').props({ className: 'feature' })(
            el('h3')('⚡ Fast'),
            el('p')('Server-rendered HTML with zero JavaScript by default.')
          ),
          el('div').props({ className: 'feature' })(
            el('h3')('🎯 Simple'),
            el('p')(
              'Same code runs on server and client. No framework lock-in.'
            )
          ),
          el('div').props({ className: 'feature' })(
            el('h3')('🔧 Flexible'),
            el('p')(
              "Add interactivity where you need it, keep static where you don't."
            )
          )
        )
      )
    );
