# Lattice Select API Type Safety

This directory contains tests and examples that demonstrate the use of the `.select()` method in Lattice, particularly focusing on type safety across component boundaries.

## Key Files

- `fluent.ts`: Contains the implementation of the `.select()` method on the `compose` API
- `core.ts`: Contains the underlying `selectWith` function that provides the core functionality
- `select.integration.test.ts`: Contains working tests that demonstrate the correct usage patterns
- `select.example.ts`: Contains commented out code examples that demonstrate type errors

## Type Safety When Using `.select()`

One of the key benefits of the `.select()` method is that it enforces type safety at compile time. This is particularly important when composing components, as it prevents runtime errors where a view might try to access a selector that has been filtered out.

### The Problem

When using `.select()` to filter properties from selectors, you need to be careful about dependencies between selectors and views. If a view depends on a selector property that has been filtered out, TypeScript will catch this at compile time.

```typescript
// This would cause a type error in the real codebase:
const extendedComponent = extendComponent(baseComponent, ({ selectors, view }) => {
  // ERROR: We filter out isPositive, which counterView needs
  const filteredSelectors = compose(selectors).select(base => ({
    count: base.count
    // isPositive is intentionally omitted but required by view.counter
  }));
  
  return {
    selectors: filteredSelectors,
    view: view // Type error: view.counter requires isPositive
  };
});
```

### Correct Approaches

There are three safe approaches to using `.select()` across component boundaries:

1. **Keep all required selectors**:
   ```typescript
   const safeExtension = extendComponent(baseComponent, ({ selectors, view }) => {
     const safeSelectors = compose(selectors).select(base => ({
       count: base.count,
       isPositive: base.isPositive // Keep this selector since views need it
     }));
     
     return {
       selectors: safeSelectors,
       view: view  // Now this is type-safe
     };
   });
   ```

2. **Only include compatible views**:
   ```typescript
   const safeExtension = extendComponent(baseComponent, ({ selectors, view }) => {
     const filteredSelectors = compose(selectors).select(base => ({
       count: base.count
       // isPositive is intentionally omitted
     }));
     
     // Only include views that don't use isPositive
     const filteredViews = {
       button: view.button // This view doesn't use isPositive
       // Omit view.counter since it depends on isPositive
     };
     
     return {
       selectors: filteredSelectors,
       view: filteredViews
     };
   });
   ```

3. **Create new views that only use the available selectors**:
   ```typescript
   const safeExtension = extendComponent(baseComponent, ({ selectors }) => {
     const filteredSelectors = compose(selectors).select(base => ({
       count: base.count
       // isPositive is intentionally omitted
     }));
     
     // Create a new view that doesn't depend on the omitted selector
     const counterView = createView({ selectors: filteredSelectors }, ({ selectors }) => ({
       'data-count': selectors().count
       // Doesn't try to use isPositive
     }));
     
     return {
       selectors: filteredSelectors,
       view: {
         counter: counterView
       }
     };
   });
   ```

## Testing

The test suite (`select.integration.test.ts`) contains working examples of proper `.select()` usage with component composition. The tests verify that:

1. Selectors can be properly filtered when composing components
2. Views that depend on filtered selectors are handled correctly
3. The resulting component functions as expected

However, due to the intentional demonstration of type errors, running `pnpm typecheck` will show errors in the test files. These errors are expected and demonstrate the type safety features at work.