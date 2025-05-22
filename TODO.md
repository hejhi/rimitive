# Lattice Architectural TODOs

This file tracks high-level architectural decisions and missing pieces that need to be defined before the adapter ecosystem can be fully implemented.

## Critical Missing Pieces

### 1. Standardized Lattice API Interface
**Priority: High**

Define the standardized interface that all store adapters must implement and all framework adapters can consume. This is the contract that enables mix-and-match adapter compatibility.

**Current Status**: Undefined - only exists as pseudocode in CLAUDE.md

**Required Interface Elements** (minimum):
- `getSelectors()` - Access current selector values
- `getActions()` - Access action functions  
- `subscribe()` - Subscribe to state changes
- Potentially: `getViews()`, `getModel()`, `destroy()`, etc.

**Location**: Should be defined in `packages/core/src/shared/types.ts` or new `packages/core/src/shared/lattice-api.ts`

**Blocks**: All adapter implementations

---

### 2. Adapter Compatibility Matrix Implementation
**Priority: Medium**

Implement the `.with()` builder pattern that enables type-safe adapter compatibility declarations.

**Example**:
```typescript
export const zustandStore = createZustandStoreAdapter
  .with(reactAdapter, vueAdapter, svelteAdapter, vanillaAdapter);
```

**Current Status**: Conceptual only

**Requires**: Type system design for compatibility validation

---

### 3. Dynamic Selector Bridging
**Priority: Low**

Implement dynamic extraction of selector computation logic from factory selectors (currently hardcoded in create-with-adapter.ts).

**Current Status**: Has proof-of-concept with hardcoded counter selectors, todo test exists

**Note**: May not be necessary if adapter architecture handles this differently

---

## Adapter Ecosystem TODOs

### Store Adapters to Implement
- [ ] Zustand adapter (reference implementation)
- [ ] Redux/RTK adapter
- [ ] Jotai adapter
- [ ] Custom/minimal adapter
- [ ] NextJS adapter (React-coupled)

### Framework Adapters to Implement  
- [ ] React adapter (hooks)
- [ ] Vue adapter (composables)
- [ ] Svelte adapter (stores)
- [ ] Vanilla adapter (direct API)

### Documentation
- [ ] Adapter development guide
- [ ] Migration guide from other state management
- [ ] Performance comparison between adapters
- [ ] Compatibility matrix documentation

---

## Architecture Decisions Needed

### 1. Standardized API Shape
- What methods should be required vs optional?
- How to handle view layer in the API?
- Error handling patterns across adapters
- Performance monitoring/debugging interface

### 2. Adapter Packaging Strategy
- Separate npm packages per adapter?
- Monorepo with separate build outputs?
- Peer dependency management
- Version compatibility strategy

### 3. Type Safety Across Adapters
- How to preserve TypeScript contracts across adapter boundaries?
- Generic type parameter flow from component → store adapter → framework adapter
- Runtime type validation needs

---

**Note**: Items should be moved to implementation when architectural decisions are made and specifications are written.