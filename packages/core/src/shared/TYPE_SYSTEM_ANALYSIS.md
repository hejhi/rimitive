# Type System Analysis: Lattice's Composition Challenges

## Problem Statement

The Lattice framework exhibits several type errors in the `from.ts` implementation when running `pnpm typecheck`. These errors prevent proper type inference and composition of components, particularly when using the `from()` API to create actions, selectors, and views. Key errors include:

```
src/shared/from.ts(45,17): error TS2394: This overload signature is not compatible with its implementation signature.

src/shared/from.ts(115,15): error TS2322: Type 'SelectorsFactory<TSelectors>' is not assignable to type 'TSelectors | undefined'.

src/shared/compose/select.integration.test.ts(59,9): error TS2322: Type 'ViewFactory<CounterView, CounterSelectors, ActionsFactory<CounterActions>>' is not assignable to type 'ViewFactory<CounterView, unknown, unknown>'.
```

These errors reveal fundamental challenges in maintaining type safety within Lattice's composition system.

## Composition Phase vs. Runtime Phase

To understand the type system issues, it's critical to clarify the distinction between Lattice's composition phase and runtime phase:

### Composition Phase
- **Factory Creation**: The `createModel`, `createActions`, `createSelectors`, and `createView` functions create branded factory functions
- **Type Branding**: Functions are branded with symbols for runtime type checking
- **Blueprint Building**: Users are essentially composing blueprints of Zustand store slices, not creating actual stores yet

### Runtime Phase
- **Store Instantiation**: Factories are executed with actual Zustand store tools (get/set functions)
- **Store Management**: Zustand stores are created and managed with the composed blueprints
- **Component Usage**: State and views are consumed in UI components
- **Tool Provision**: This is when the actual `get`/`set` tools are provided to the factory functions

The primary challenge is that TypeScript struggles to maintain proper type relationships between these two phases. Functions defined in the composition phase make promises about types that are challenging to fulfill at runtime.
