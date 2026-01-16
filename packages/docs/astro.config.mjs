// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://rimitive.dev',
  integrations: [
    starlight({
      title: 'Rimitive',
      sidebar: [
        {
          label: 'Start Here',
          items: [{ label: 'Getting Started', slug: 'guides/getting-started' }],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Composing Signals', slug: 'guides/composing-signals' },
            {
              label: 'Creating a Behavior',
              slug: 'guides/creating-a-behavior',
            },
            { label: 'Adding View', slug: 'guides/adding-view' },
            { label: 'Dynamic Views', slug: 'guides/dynamic-views' },
            { label: 'Event Handling', slug: 'guides/event-handling' },
            { label: 'Loading Data', slug: 'guides/loading-data' },
            { label: 'Adding Routing', slug: 'guides/adding-routing' },
            { label: 'Server Rendering', slug: 'guides/server-rendering' },
            { label: 'Streaming SSR', slug: 'guides/streaming-ssr' },
            { label: 'Custom Modules', slug: 'guides/custom-modules' },
          ],
        },
        {
          label: 'Patterns',
          items: [
            { label: 'Overview', slug: 'patterns' },
            { label: 'Behaviors', slug: 'patterns/behaviors' },
            { label: 'Portability', slug: 'patterns/portability' },
            { label: 'Shared State', slug: 'patterns/shared-state' },
            { label: 'Error Handling', slug: 'patterns/error-handling' },
            { label: 'Async Loading', slug: 'patterns/async-loading' },
            {
              label: 'Composition Over Stores',
              slug: 'patterns/composition-over-stores',
            },
            { label: 'Refs & DOM Access', slug: 'patterns/refs' },
          ],
        },
        {
          label: 'Benchmarks',
          slug: 'benchmarks',
        },
        {
          label: 'Why Rimitive?',
          slug: 'why',
        },
        {
          label: 'FAQ',
          slug: 'faq',
        },
        {
          label: 'API Reference',
          collapsed: true,
          autogenerate: { directory: 'api' },
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
  ],
});
