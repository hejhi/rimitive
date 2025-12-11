// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://lattice.dev',
	integrations: [
		starlight({
			title: 'Lattice',
			sidebar: [
				{
					label: 'Start Here',
					items: [],
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
						{ label: 'Composition Over Stores', slug: 'patterns/composition-over-stores' },
						{ label: 'Refs & DOM Access', slug: 'patterns/refs' },
					],
				},
				{
					label: 'Examples',
					items: [],
				},
				{
					label: 'Advanced',
					items: [],
				},
				{
					label: 'API Reference',
					collapsed: true,
					autogenerate: { directory: 'api' },
				},
			],
			customCss: [
				'./src/styles/custom.css',
			],
		}),
	],
});