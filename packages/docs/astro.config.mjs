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
            { label: 'Refs & DOM Access', slug: 'guides/refs' },
            { label: 'Rendering Lists', slug: 'guides/rendering-lists' },
            {
              label: 'Conditional Rendering',
              slug: 'guides/conditional-rendering',
            },
            { label: 'Portals', slug: 'guides/portals' },
            { label: 'Event Handling', slug: 'guides/event-handling' },
            { label: 'Loading Data', slug: 'guides/loading-data' },
            { label: 'Adding Routing', slug: 'guides/adding-routing' },
            { label: 'Intro to SSR', slug: 'guides/intro-to-ssr' },
            { label: 'Server Rendering', slug: 'guides/server-rendering' },
            { label: 'Client Hydration', slug: 'guides/client-hydration' },
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
          label: 'Examples',
          collapsed: true,
          items: [
            {
              label: 'View Basics',
              link: 'https://github.com/hejhi/rimitive/tree/main/packages/examples/view',
              attrs: { target: '_blank' },
              badge: { text: '↗', variant: 'note' },
            },
            {
              label: 'Router',
              link: 'https://github.com/hejhi/rimitive/tree/main/packages/examples/router',
              attrs: { target: '_blank' },
              badge: { text: '↗', variant: 'note' },
            },
            {
              label: 'SSR',
              link: 'https://github.com/hejhi/rimitive/tree/main/packages/examples/ssr-router',
              attrs: { target: '_blank' },
              badge: { text: '↗', variant: 'note' },
            },
            {
              label: 'SSR + Async Data',
              link: 'https://github.com/hejhi/rimitive/tree/main/packages/examples/ssr-router-async',
              attrs: { target: '_blank' },
              badge: { text: '↗', variant: 'note' },
            },
            {
              label: 'SSR + Streaming',
              link: 'https://github.com/hejhi/rimitive/tree/main/packages/examples/ssr-router-streaming',
              attrs: { target: '_blank' },
              badge: { text: '↗', variant: 'note' },
            },
            {
              label: 'Headless Components',
              link: 'https://github.com/hejhi/rimitive/tree/main/packages/examples/headless',
              attrs: { target: '_blank' },
              badge: { text: '↗', variant: 'note' },
            },
            {
              label: 'React Integration',
              link: 'https://github.com/hejhi/rimitive/tree/main/packages/examples/react',
              attrs: { target: '_blank' },
              badge: { text: '↗', variant: 'note' },
            },
            {
              label: 'Custom Adapter (Canvas)',
              link: 'https://github.com/hejhi/rimitive/tree/main/packages/examples/canvas',
              attrs: { target: '_blank' },
              badge: { text: '↗', variant: 'note' },
            },
          ],
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
