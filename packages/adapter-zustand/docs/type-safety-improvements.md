# React Hooks Type Safety Improvements

## Summary of Changes

This document outlines the type safety improvements made to the React hooks in the `@lattice/adapter-zustand` package.

## Problems Fixed

1. **Weak typing in hooks**: Previously, hooks relied on `any` types internally, which could leak through to user code
2. **Poor type inference**: The original API required passing both store and key separately, making type inference more difficult
3. **Lack of type safety**: Type errors weren't caught at compile time as effectively

## Solutions Implemented

### 1. Improved `useModelSelector` Hook

**Old API** (still supported for backward compatibility):
```tsx
const count = useModelSelector(store, 'count');
// Required passing store and key separately
```

**New API** (recommended):
```tsx
const count = useModelSelector(store.use.count);
// Direct selector hook usage with full type inference
```

Benefits:
- **Strong type inference**: TypeScript knows `count` is a `number` without explicit type annotations
- **Better DX**: The selector hook is self-contained, no need to pass the store separately
- **Type safety**: Invalid property access is caught at compile time

### 2. Enhanced Type Assertions

All hooks now use proper type assertions to ensure type information flows correctly:

```typescript
// Before: weak typing
export function useAction(store, key) {
  return store.actions[key](); // Could return any
}

// After: strong typing
export function useAction<
  S extends ZustandAdapterResult<any, any, any>,
  K extends keyof ExtractActions<S>
>(store: S, key: K): ExtractActions<S>[K] {
  type ActionType = ExtractActions<S>[K];
  const actionHook = store.actions[key] as () => ActionType;
  return actionHook();
}
```

### 3. Improved View Type Resolution

Views now properly resolve their types including computed views:

```typescript
// Properly typed view store resolution
const viewStore = typeof view === 'function' 
  ? (view as () => Store<ExtractView<S, K>>)() 
  : view as Store<ExtractView<S, K>>;
```

### 4. Better `useActions` Type Safety

The `useActions` hook now ensures all actions maintain their proper types:

```typescript
const actions = useActions(store);
// actions.increment: () => void
// actions.setName: (name: string) => void
// All properly typed!
```

## Migration Guide

### For `useModelSelector`

```tsx
// Old way (still works)
const count = useModelSelector(counterStore, 'count');

// New way (recommended)
const count = useModelSelector(counterStore.use.count);
```

### No Changes Required For:
- `useStore`
- `useAction`
- `useActions`
- `useView`
- `useStoreSelector`

These hooks maintain the same API but now have stronger type inference internally.

## Type Safety Examples

```tsx
// ✅ These all have proper type inference
const count = useModelSelector(store.use.count); // number
const name = useModelSelector(store.use.name); // string
const increment = useAction(store, 'increment'); // () => void
const setName = useAction(store, 'setName'); // (name: string) => void

// ❌ These cause TypeScript errors
const invalid1 = useModelSelector(store.use.notExist); // Error!
const invalid2 = useAction(store, 'notAnAction'); // Error!
setName(123); // Error: Argument of type 'number' is not assignable to parameter of type 'string'
```

## Benefits

1. **No `any` types leak through**: All hooks return properly typed values
2. **Better IDE support**: Autocomplete and IntelliSense work perfectly
3. **Compile-time safety**: Type errors are caught during development
4. **Backward compatible**: Existing code continues to work
5. **Improved developer experience**: Less need for explicit type annotations

## Technical Details

The improvements leverage TypeScript's type inference capabilities:

- **Conditional types** for extracting nested types from the store
- **Generic constraints** to ensure type safety
- **Function overloading** for backward compatibility
- **Type assertions** only where necessary and safe

These changes ensure that Lattice's compositional patterns work seamlessly with TypeScript's type system, providing a superior developer experience.