// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://rimitive.dev',
  integrations: [
    starlight({
      title: 'Rimitive',
      logo: {
        light: './public/logo.svg',
        dark: './public/logo-dark.svg',
        alt: 'Rimitive',
      },
      favicon: '/favicon.svg',
      sidebar: [
        {
          label: '⭐️ Start Here',
          items: [{ label: 'Getting Started', slug: 'guides/getting-started' }],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Creating a Service', slug: 'guides/creating-a-service' },
            { label: 'Using a Service', slug: 'guides/using-a-service' },
            {
              label: 'Creating a Behavior',
              slug: 'guides/creating-a-behavior',
            },
            { label: 'Adding a UI', slug: 'guides/adding-a-ui' },
            { label: 'Rendering Lists', slug: 'guides/rendering-lists' },
            {
              label: 'Conditional Rendering',
              slug: 'guides/conditional-rendering',
            },
            { label: 'Portals', slug: 'guides/portals' },
            { label: 'Event Handling', slug: 'guides/event-handling' },
            { label: 'Loading Data', slug: 'guides/loading-data' },
            { label: 'Adding Routing', slug: 'guides/adding-routing' },
            { label: 'Server Rendering', slug: 'guides/server-rendering' },
            { label: 'SSR with Data Loading', slug: 'guides/ssr-loading' },
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
