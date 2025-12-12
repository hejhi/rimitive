# @rimitive/devtools-extension

> **Status: In Development**
> This extension is under active development and not yet published.

Chrome DevTools extension for debugging Rimitive reactive applications.

## Features (Planned)

- **Context Inspector** — View all Rimitive contexts in your application
- **Signal Logging** — Track signal reads, writes, and computed updates
- **Dependency Graph** — Visualize reactive dependencies
- **Timeline View** — See when signals change and effects run
- **Filtering** — Filter events by type, context, or search term

## Development

### Prerequisites

- Node.js 18+
- pnpm
- Chrome or Firefox

### Setup

```bash
# From the monorepo root
pnpm install

# Start the extension in dev mode
pnpm --filter @rimitive/devtools-extension dev

# Or for Firefox
pnpm --filter @rimitive/devtools-extension dev:firefox
```

### Loading the Extension

**Chrome:**

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `packages/devtools-extension/.output/chrome-mv3`

**Firefox:**

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select any file in `packages/devtools-extension/.output/firefox-mv2`

### Building

```bash
# Production build
pnpm --filter @rimitive/devtools-extension build

# Create distributable zip
pnpm --filter @rimitive/devtools-extension zip
```

## Architecture

Built with [WXT](https://wxt.dev/) (Web Extension Tools) and React.

```
entrypoints/
├── background.ts      # Service worker
├── content.content.ts # Content script injected into pages
├── devtools/          # DevTools panel registration
└── panel/             # DevTools panel UI (React)
    ├── components/    # UI components
    ├── hooks/         # React hooks
    └── store/         # State management (uses Rimitive signals!)
```

The extension itself uses Rimitive signals for its internal state management.

## License

MIT
