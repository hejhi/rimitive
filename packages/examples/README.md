# Lattice Examples

This package demonstrates various usage patterns for Lattice, showing how to:

- Define reusable behavior specifications with the required API parameter
- Use the API parameter for state access and slice composition
- Use different state management adapters for different parts of your app
- Mix and match state managers based on specific needs
- Compose complex behaviors from simple primitives
- Test behavior specifications independently of implementation

## Structure

- `slices/` - Reusable behavior specifications (the "single source of truth")
- `patterns/` - Different usage patterns and scenarios
- `apps/` - Example applications showing real-world usage

## Key Examples

### 1. Single Source of Truth (`slices/`)
All behavior specifications in one place, completely decoupled from state management.
Every slice receives `(model, api)` parameters for maximum flexibility.

### 2. API Parameter Usage (`patterns/api-basics.tsx`)
Shows fundamental API parameter features: `getState()` and `executeSlice()`.

### 3. Advanced API Patterns (`patterns/api-logging.tsx`, `patterns/adapter-api-zustand.tsx`)
Demonstrates logging, debugging, and adapter-specific API extensions.

### 4. Mixed State Management (`patterns/mixed-stores.tsx`)
Shows using Zustand for some components and Redux for others in the same app.

### 5. Server-Side Rendering (`patterns/ssr.tsx`)
Demonstrates using the memory adapter for SSR with hydration.

### 6. Migration Strategy (`patterns/migration.tsx`)
How to gradually migrate from one state manager to another.

### 7. Testing (`patterns/testing.test.ts`)
Testing behavior specifications independently of state management implementation.

## Quick API Parameter Example

```typescript
import { createSlice, createModel } from '@lattice/core';

// Every slice receives (model, api)
const actions = createSlice(model, (m, api) => ({
  increment: m.increment,
  
  // Use api.getState() to access current state
  loggedIncrement: () => {
    console.log('Current count:', api.getState().count);
    m.increment();
  },
  
  // Use api.executeSlice() to compose behaviors
  smartIncrement: () => {
    const stats = api.executeSlice(statsSlice);
    if (stats.canIncrement) {
      m.increment();
    }
  }
}));

// The API parameter enables powerful patterns without coupling
const debugSlice = createSlice(model, (m, api) => ({
  modelCount: m.count,
  stateCount: api.getState().count,
  history: api.executeSlice(historySlice)
}));
```

## Running Examples

```bash
# Type check
pnpm typecheck

# Run tests
pnpm test
```