# API Layers Analysis

## The Current Disconnect

Looking at Lattice's documentation, there's a fundamental mismatch between two visions:

### README Vision (Rich API)
- Complex, expressive tools: `withCompute`, `withSelect`, `withDerive`
- Layer-specific patterns with specialized tools for each building block
- Explicit tool passing: `({ set, get }, { compute })`
- Detailed compositional patterns

### Adapter Spec Vision (Minimal Primitives)
- Just 3 primitives: `atom`, `computed`, `effect`
- "Specs are data" philosophy
- Maximum adapter freedom
- Unopinionated execution

## The Core Issue

The README presents Lattice as having a specific, opinionated API, while the adapter spec suggests it should be unopinionated. This creates confusion about what Lattice actually *is*.

## The Solution: Layered Architecture

Based on successful libraries like TanStack Query and Nano Stores, the best practice is to have **both** - but make the relationship clear:

```
┌─────────────────────────────────────┐
│     User API (Rich & Expressive)    │  ← What developers write
├─────────────────────────────────────┤
│   Core Lattice (Transformation)     │  ← Transforms rich API to primitives
├─────────────────────────────────────┤
│  Adapter Primitives (Minimal)       │  ← What adapters provide
└─────────────────────────────────────┘
```

## How This Works

### Layer 1: User API (What You Write)
```typescript
const model = createModel(
  withCompute(({ set, get }, { compute }) => ({
    count: 0,
    doubled: compute(() => get().count * 2),
    increment: () => set({ count: get().count + 1 })
  }))
);
```

### Layer 2: Core Transformation
Lattice transforms the rich specifications into primitive operations:

```typescript
// withCompute knows how to express itself using primitives
withCompute.transform = (factory, primitives) => {
  const { atom, computed } = primitives;
  const state = atom(/* initial state */);
  
  // Transform compute() calls to computed()
  // Transform set/get to atom operations
  // Return executable specification
};
```

### Layer 3: Adapter Execution
```typescript
// Adapter just provides the primitives
const zustandPrimitives = {
  atom: (initial) => /* Zustand store */,
  computed: (fn) => /* Zustand computed */,
  effect: (fn) => /* Zustand effect */
};

// Lattice handles the transformation
const store = executeWithAdapter(spec, zustandPrimitives);
```

## Benefits of This Approach

1. **Rich Developer Experience**: Keep the expressive API that makes Lattice powerful
2. **Adapter Simplicity**: Adapters only need to provide 3 primitives
3. **Clear Separation**: Each layer has a clear responsibility
4. **Future Flexibility**: New tools can be added without changing adapters

## What Needs to Change

### 1. Clarify the Architecture
The README should acknowledge that the rich API compiles down to primitives:

> "Lattice provides a rich, expressive API for defining behavior. Under the hood, these specifications are transformed into simple primitive operations that any state management library can provide."

### 2. Show the Transformation
Add examples showing the conceptual transformation:

```typescript
// What you write (declarative, rich)
withCompute(({ set, get }, { compute }) => ({
  doubled: compute(() => get().count * 2)
}))

// What adapters see (primitive operations)
{ 
  doubled: computed(() => atom.get().count * 2)
}
```

### 3. Update the Adapter Spec
Add a section explaining that adapters don't see the rich API - they just provide primitives:

> "Adapters provide three core primitives. Lattice transforms rich user specifications into operations using only these primitives."

## The Missing Piece

Currently missing: the transformation layer documentation. This should explain:

1. How each tool (`withCompute`, `withSelect`, etc.) maps to primitives
2. How Lattice orchestrates the execution
3. How type safety is preserved through the transformation

## Conclusion

The apparent conflict between the README and adapter spec isn't a bug - it's a feature. They're describing different layers of the same system. The key is making this layered architecture explicit and showing how they work together to provide both a rich developer experience and simple adapter requirements.