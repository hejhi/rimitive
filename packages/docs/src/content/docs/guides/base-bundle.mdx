---
title: Minimal Bundle Guide
description: How to use Lattice with the smallest possible bundle size
---

import { Card, Aside, Code } from '@astrojs/starlight/components';

Want the absolute smallest bundle? Here's how to optimize your Lattice usage for size-conscious applications.

## Bundle Size Options

Lattice provides multiple entry points depending on your needs:

| Import | Size | Includes |
|--------|------|----------|
| `@lattice/core` | 1.2 KB | Everything: slices, compose, runtime, subscriptions |
| `@lattice/core/base` | ~400 B | Just createStore + compose |
| `@lattice/core/store` | ~200 B | Just createStore (if you don't need compose) |

## Minimal Usage (~400 bytes)

For the smallest bundle, use the base export:

```typescript
import { createStore, compose } from '@lattice/core/base';

// Create a store with just get/set
const createSlice = createStore({ count: 0 });

const counter = createSlice(({ get, set }) => ({
  value: () => get().count,
  increment: () => set({ count: get().count + 1 })
}));

// That's it! No adapters, no runtime, just pure state management
```

## Ultra-Minimal Usage (~200 bytes)

If you don't even need composition, import just the store:

```typescript
import { createStore } from '@lattice/core/store';

const createSlice = createStore({ count: 0 });

const counter = createSlice(({ get, set }) => ({
  value: () => get().count,
  increment: () => set({ count: get().count + 1 })
}));
```

<Aside type="note">
  This approach gives you state management smaller than Zustand (588B) but without framework integration. You'll need to handle subscriptions manually.
</Aside>

## What You Give Up

The minimal exports are tiny but exclude:

- ❌ Framework adapters (Redux, Zustand integration)
- ❌ Runtime hooks (useSliceValues, etc.)
- ❌ Selective subscriptions
- ❌ Memoization utilities
- ❌ TypeScript helpers for complex scenarios

## When to Use Minimal

<Card title="✅ Good for" icon="check">
  - Vanilla JavaScript projects
  - Size-critical applications (embedded, IoT)
  - Simple state management needs
  - Learning Lattice concepts
</Card>

<Card title="❌ Not ideal for" icon="x">
  - React/Vue/Svelte applications (need runtime)
  - Complex state management (need full features)
  - Teams already using Redux/Zustand (need adapters)
</Card>

## Comparison with Zustand

Yes, Zustand is 588B. But here's what Lattice minimal gives you that Zustand doesn't:

```typescript
// Lattice - Works everywhere
const counter = createSlice(({ get, set }) => ({
  value: () => get().count,
  increment: () => set({ count: get().count + 1 })
}));

// Use in React, Vue, Svelte, or vanilla JS
// Same behavior code, different runtime bindings
```

```typescript
// Zustand - React only
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 }))
}));

// Locked to React hooks
```

## Migration Path

Start minimal, grow as needed:

```typescript
// 1. Start with base (400B)
import { createStore } from '@lattice/core/base';

// 2. Need framework support? Add runtime (+ 300B)
import { useSliceValues } from '@lattice/runtime';

// 3. Need Zustand integration? Use full core (1.2KB total)
import { createSlice } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';
```

## The Verdict

- **Need tiny + portable?** Use `@lattice/core/base` (400B)
- **Need tiny + React-only?** Use Zustand (588B)
- **Need portable + full features?** Use full Lattice (1.5KB)

<Aside type="tip">
  400 bytes for framework-agnostic state management is incredibly small. That's smaller than a typical Google Analytics event!
</Aside>