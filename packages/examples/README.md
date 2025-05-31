# Lattice Examples

This package demonstrates various usage patterns for Lattice, showing how to:

- Define reusable behavior specifications in a single file
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

### 2. Mixed State Management (`patterns/mixed-stores.tsx`)
Shows using Zustand for some components and Redux for others in the same app.

### 3. Server-Side Rendering (`patterns/ssr.tsx`)
Demonstrates using the memory adapter for SSR with hydration.

### 4. Migration Strategy (`patterns/migration.tsx`)
How to gradually migrate from one state manager to another.

### 5. Testing (`patterns/testing.test.ts`)
Testing behavior specifications independently of state management implementation.

## Running Examples

```bash
# Type check
pnpm typecheck

# Run tests
pnpm test
```