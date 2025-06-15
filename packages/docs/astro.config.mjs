// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://lattice.dev',
	integrations: [
		starlight({
			title: 'Lattice',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/yourusername/lattice' },
				{ icon: 'discord', label: 'Discord', href: '/discord' },
			],
			sidebar: [
				{
					label: 'Start Here',
					items: [
						{ label: 'Getting Started', slug: 'guides/getting-started' },
						{ label: 'Bundle Size & Performance', slug: 'guides/bundle-size' },
					],
				},
				{
					label: 'Examples',
					items: [
						{ label: 'Dropdown Component', slug: 'guides/dropdown-example' },
					],
				},
				{
					label: 'Advanced',
					items: [
						{ label: 'Minimal Bundle', slug: 'guides/base-bundle' },
						{ label: 'Import Patterns', slug: 'guides/import-patterns' },
					],
				},
			],
			customCss: [
				'./src/styles/custom.css',
			],
		}),
	],
});