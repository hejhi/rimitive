# @lattice/zustand

Zustand store adapter for Lattice - enables using Lattice behavior specifications with Zustand for state management.

## Installation

```bash
npm install @lattice/zustand zustand
```

## Usage

This adapter allows you to use Lattice component specifications with Zustand as the underlying state management solution.

```typescript
import { createZustandAdapter } from '@lattice/zustand';
import { myComponent } from './my-component';

// Create a Zustand store from your Lattice component
const store = createZustandAdapter(myComponent);
```

## Features

- Seamless integration between Lattice behavior specifications and Zustand stores
- Type-safe state management
- Support for all Zustand features (middleware, devtools, etc.)
- Framework-agnostic - works with React, Vue, or vanilla JS

## Documentation

For full documentation, see the [Lattice documentation](https://github.com/yourusername/lattice).