---
title: Import Patterns & Composable Architecture
description: Lattice's composable design lets you import only what you need
---

import { Card, Aside, CardGrid } from '@astrojs/starlight/components';

<Aside type="tip" title="Philosophy: Use Only What You Need">
  Lattice is built on the principle of composability. Each feature is available as a separate import, so you only bundle what you actually use. This isn't just about optimization - it's about giving you architectural control.
</Aside>

## Lattice's Composable Architecture

Lattice isn't a monolithic library - it's a collection of focused, composable utilities. Import the whole toolkit or just the pieces you need:

### Available Imports

```typescript
// 🎯 Individual imports - maximum control
import { compose } from '@lattice/core/compose';       // 0.2 KB - Slice composition
import { createStore } from '@lattice/core/store';     // 0.1 KB - State primitive
import { subscribeToSlices } from '@lattice/core/subscribe'; // 0.3 KB - Subscriptions
import { createLatticeStore } from '@lattice/core/runtime';  // 0.4 KB - Runtime

// 🚀 Convenience imports
import { createSlice, compose } from '@lattice/core';  // 1.1 KB - Full toolkit
import { createStore, compose } from '@lattice/core/base'; // 0.2 KB - Essentials only
```

## Import Strategies

### 1. Standard Import (Recommended for Apps)
```typescript
import { createSlice, compose } from '@lattice/core';
import { useSliceValues } from '@lattice/runtime';

// ✅ Best for most applications
// ✅ Modern bundlers tree-shake unused code
// ✅ Great developer experience
```

### 2. Granular Imports (Maximum Control)
```typescript
// Import exactly what you need
import { compose } from '@lattice/core/compose';
import { subscribeToSlices } from '@lattice/core/subscribe';

// ✅ Perfect control over bundle size
// ✅ Clear dependencies
// ✅ Ideal for libraries and tools
```

### 3. Base Import (Lightweight Foundation)
```typescript
import { createStore, compose } from '@lattice/core/base';

// ✅ Just 0.2 KB
// ✅ No runtime features
// ✅ Perfect for Node.js, CLI tools, tests
```

## Bundle Size Breakdown

| Import | Size | What You Get |
|--------|------|--------------|
| `@lattice/core` | 1.1 KB | Complete toolkit with all features |
| `@lattice/core/base` | 0.2 KB | Just createStore + compose |
| `@lattice/core/compose` | 0.2 KB | Slice composition utility |
| `@lattice/core/store` | 0.1 KB | Basic state management |
| `@lattice/core/subscribe` | 0.3 KB | Subscription utilities |
| `@lattice/core/runtime` | 0.4 KB | Adapter integration |

## Real-World Examples

### Example 1: Minimal State for a CLI Tool
```typescript
// Just need basic state? Import only the store primitive
import { createStore } from '@lattice/core/store';

const config = createStore({ 
  verbose: false,
  outputDir: './dist' 
});

// That's it! Just 0.1 KB for state management
```

### Example 2: Composing Behaviors
```typescript
// Need composition? Add just what you need
import { createStore } from '@lattice/core/store';
import { compose } from '@lattice/core/compose';

const store = createStore({ count: 0 });
const counter = compose(store, ({ get, set }) => ({
  increment: () => set({ count: get().count + 1 })
}));

// Total: 0.3 KB (store + compose)
```

### Example 3: Full Framework Integration
```typescript
// Building a React app? Use the standard import
import { createSlice, compose } from '@lattice/core';
import { useSliceValues } from '@lattice/runtime';

// Modern bundlers will tree-shake unused features
// You get convenience without bloat
```

## When to Use Each Pattern

<CardGrid>
  <Card title="Standard Import" icon="document">
    ```typescript
    import { createSlice } from '@lattice/core';
    ```
    
    **Perfect for:**
    - React/Vue/Svelte apps
    - Quick prototypes
    - Modern build tools
    - Developer experience
  </Card>

  <Card title="Granular Imports" icon="puzzle">
    ```typescript
    import { compose } from '@lattice/core/compose';
    ```
    
    **Perfect for:**
    - Library authors
    - Bundle size critical apps
    - Custom abstractions
    - Clear dependencies
  </Card>

  <Card title="Base Import" icon="package">
    ```typescript
    import { createStore } from '@lattice/core/base';
    ```
    
    **Perfect for:**
    - Server-side code
    - CLI tools
    - Test utilities
    - Non-UI environments
  </Card>
</CardGrid>

## The Composability Advantage

<Aside type="note" title="Not Just About Size">
  Lattice's composable architecture isn't just about bundle size - it's about flexibility. Build exactly what you need:
  
  - **Just state?** Use `createStore` (0.1 KB)
  - **Need composition?** Add `compose` (+0.2 KB)
  - **Want subscriptions?** Import `subscribe` (+0.3 KB)
  - **Full framework support?** Go with the standard import (1.1 KB total)
</Aside>

## Progressive Enhancement

Start small and add features as needed:

```typescript
// Day 1: Just need state
import { createStore } from '@lattice/core/store';

// Day 7: Need composition
import { compose } from '@lattice/core/compose';

// Day 30: Full app with React
import { createSlice, compose } from '@lattice/core';
import { useSliceValues } from '@lattice/runtime';
```

## Bundler Configuration

<Tabs>
  <TabItem label="Vite">
    ```javascript
    // vite.config.js
    export default {
      // Vite handles tree-shaking automatically
      // No special config needed!
    }
    ```
  </TabItem>
  <TabItem label="Webpack 5">
    ```javascript
    // webpack.config.js
    module.exports = {
      optimization: {
        usedExports: true,
        sideEffects: false
      }
    }
    ```
  </TabItem>
  <TabItem label="ESBuild">
    ```javascript
    // build.js
    require('esbuild').build({
      treeShaking: true, // Default
      bundle: true
    })
    ```
  </TabItem>
</Tabs>

## Verifying Your Bundle

Want to see exactly what's included? Use bundle analysis:

```bash
# Vite
npx vite-bundle-visualizer

# Webpack
npx webpack-bundle-analyzer

# General
npx source-map-explorer dist/main.js
```

<Card title="🎯 Pro Tip: Start Standard, Optimize Later">
  For most apps, start with the standard import. If you need to optimize later, switching to granular imports is a simple refactor. Don't premature optimize - 1.1 KB won't break your performance budget!
</Card>

---

**Questions?** Check our [bundle size guide](/guides/bundle-size) for detailed measurements or ask in [Discord](https://discord.gg/lattice).