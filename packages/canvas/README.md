# @lattice/canvas

Canvas renderer for Lattice - enables reactive canvas-based graphics with Lattice's reactive primitives.

## Status

🚧 **Work in Progress** - This package is currently in development.

## Installation

```bash
pnpm add @lattice/canvas
```

## Usage

```typescript
import { createCanvasRenderer } from '@lattice/canvas';

const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
const renderer = createCanvasRenderer(canvas);

// TODO: Usage examples
```

## Development

```bash
# Build
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint

# Run tests
pnpm test
```

## License

MIT
