# Rimitive Documentation

Documentation site for Rimitive, built with [Astro](https://astro.build/) and [Starlight](https://starlight.astro.build/).

## Development

```bash
# From the monorepo root
pnpm --filter docs dev

# Or from this directory
pnpm dev
```

The site runs at `http://localhost:4321`.

## Building

```bash
pnpm --filter docs build
pnpm --filter docs preview  # Preview the build
```

## Content Structure

```
src/content/docs/
├── index.mdx           # Landing page
├── guides/             # Step-by-step tutorials
│   ├── getting-started.mdx
│   ├── composing-signals.mdx
│   ├── creating-a-behavior.mdx
│   └── ...
├── patterns/           # Best practices and patterns
│   ├── behaviors.mdx
│   ├── shared-state.mdx
│   └── ...
└── api/                # Auto-generated API reference
```

## Adding Content

### New Guide

1. Create a file in `src/content/docs/guides/`:

```mdx
---
title: Your Guide Title
description: Brief description for SEO and previews.
---

Your content here...
```

2. Add it to the sidebar in `astro.config.mjs`:

```js
{
  label: 'Guides',
  items: [
    // ...existing items
    { label: 'Your Guide', slug: 'guides/your-guide' },
  ],
}
```

### New Pattern

Same process, but in `src/content/docs/patterns/`.

### Code Examples

Use fenced code blocks with language hints:

````mdx
```typescript
const { signal, computed } = compose(SignalModule, ComputedModule);
```
````

Starlight provides syntax highlighting automatically.

### Asides

Use Starlight's aside components for callouts:

```mdx
import { Aside } from '@astrojs/starlight/components';

<Aside type="tip">This is a tip.</Aside>

<Aside type="note">This is a note.</Aside>

<Aside type="caution">This is a caution.</Aside>
```

## API Reference

API documentation in `src/content/docs/api/` is auto-generated from source using `api-extractor` and `api-documenter`. To regenerate:

```bash
# From monorepo root
pnpm api-document
```

This extracts API metadata from each package and generates markdown files.

## Configuration

- **Site URL**: Configured in `astro.config.mjs` as `site: 'https://rimitive.dev'`
- **Sidebar**: Defined in `astro.config.mjs` under `starlight.sidebar`
- **Custom CSS**: `src/styles/custom.css`

## License

MIT
