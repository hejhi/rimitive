# State Management Research: Reactive Bindings and Adapter Patterns

## Research Question

How do other libraries offer the ability to create reactive bindings? What are the best practices for creating adapters that feel organic and natural across different state management libraries?

Key considerations:
- Do we need both `computed` and `selectors`?
- Can we simplify to just `get/set/subscribe/destroy`?
- What patterns provide best-in-class DX across libraries?

## Research Findings

### 1. Bunshi - Universal Adapter Pattern

**What it is**: A lightweight (3kb) library providing a "molecule" pattern for state management across jotai, valtio, zustand, nanostores, xstate, react and vue.

**Key insights**:
- Evolved from jotai-molecules to be framework-agnostic
- "Specs are just functions that return stores"
- Adapters provide the execution context
- Works across multiple state solutions with a unified interface

### 2. Nano Stores - Minimal Interface

**What it is**: A tiny (265-803 bytes) state manager that works across React, Vue, Svelte, Solid, Lit, Angular, and vanilla JS.

**Core interface**:
```typescript
interface Store {
  get(): any           // Retrieve current value
  set(value: any): void // Update store value
  subscribe(callback: (value: any, oldValue?: any) => void): () => void
}
```

**Key patterns**:
- Stores are "lazy" - only active when listened to
- Support fine-grained reactivity
- Framework adapters are thin wrappers that just subscribe and re-render

### 3. TanStack Query - Layered Architecture

**What it is**: Framework-agnostic data fetching library with adapters for React, Vue, Solid, Svelte, and Angular.

**Architecture**:
- **Framework-Agnostic Core**: Query logic, caching, fetching
- **Framework-Specific Adapters**: Thin layers that adapt core to each framework's reactivity
- **Consistent API**: Same patterns across all frameworks

**Key insight**: Separation between core functionality and framework bindings enables portability while respecting each framework's unique characteristics.

### 4. Common Patterns Across Libraries

#### Minimal Primitives
The most successful libraries use incredibly minimal interfaces:

```typescript
interface Store<T> {
  get(): T;
  subscribe(listener: (value: T) => void): () => void;
}
```

Note: No `set` in the interface - stores handle their own mutation patterns internally.

#### Why Minimal Works

1. **Nano Stores** proves you only need:
   - `get()` - Pull current value
   - `subscribe()` - Push updates
   - Everything else builds on these two primitives

2. **TanStack Query** separates concerns:
   - Core handles business logic
   - Adapters just connect to framework reactivity

3. **Framework adapters are thin**:
   - Usually just `useStore` hooks that subscribe and trigger re-renders
   - No complex state synchronization

## Implications for Lattice

### Current Over-Specification

We might be requiring too much from adapters. The research suggests simpler is better.

### Recommended Minimal Interface

Based on successful patterns, simplify to just three primitives:

```typescript
interface AdapterPrimitives {
  // Create a reactive value
  atom<T>(initial: T): {
    get(): T;
    set(value: T): void;
    subscribe(fn: (value: T) => void): () => void;
  };
  
  // Create a computed value (can be lazy or reactive)
  computed<T>(fn: () => T): {
    get(): T;
    subscribe(fn: (value: T) => void): () => void;
  };
  
  // Run side effects
  effect(fn: () => void | (() => void)): void;
}
```

### The Pattern That Works

1. **Specs are data** - Describe what you want, not how
2. **Adapters provide primitives** - Minimal set of reactive building blocks
3. **Framework bindings are thin** - Just subscribe and re-render

## Key Takeaway

**Less is more**. The simpler the contract between Lattice and adapters, the easier it is for adapter authors to provide idiomatic implementations for their specific libraries. This approach has proven successful across the most popular cross-framework libraries in the JavaScript ecosystem.