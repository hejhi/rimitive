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