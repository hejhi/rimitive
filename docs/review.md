Key Inconsistencies and Logic Gaps Found

After analyzing the codebase, here are the critical issues:

1. View Factory Execution Inconsistency 🚨

The views have a fundamental API inconsistency:

// In component usage examples (README):
<div {...selectableFileTree.views.file(node.id)}>

// But actual implementation requires:
views.file()(/* params */)(node.id)

The view factories return a factory that returns a function, making the API awkward. This is because views are ViewFactory objects that need to be
called with params first.

2. Enhancer Context Inconsistency ⚠️

Different factories provide different context to enhancers:

// Selectors/Actions get model access:
const context = { model };

// Views get both selectors and actions:
const context = {
  getState: () => ({
    selectors: options.selectors(),
    actions: options.actions()
  }),
};

This inconsistency makes enhancers work differently across different factory types.

3. Memoization Claims vs Reality 🚨

The documentation and comments claim memoization, but:

// derive.ts uses WeakMap with JSON.stringify keys
const cacheKey = JSON.stringify(value);

This approach:
- Won't work for objects/arrays (same content, different references)
- Has performance issues with large objects
- Doesn't actually provide React-style memoization

4. Factory Pattern Type Signatures ⚠️

The overloads for new API vs old API create confusion:

// New API with enhancers
createSelectors(modelWithEnhancers, factory)

// Old API
createSelectors({ model }, factory)

The type system can't always distinguish these properly, leading to potential runtime errors.

5. Adapter API Mismatch 🚨

The Zustand adapter assumes it can call view factories directly:

const views = fileTreeStore.getViews();
// But views.file needs to be called as: views.file()(params)(nodeId)

This makes the adapter API inconsistent with how views actually work.

6. Missing State Management Claims ⚠️

CLAUDE.md and the architecture README claim "Lattice never implements state management" but:
- Models have set and get which ARE state management primitives
- The factory pattern inherently manages state through closures

This is misleading - Lattice DOES define state management contracts, it just delegates execution.

7. Incomplete Enhancer System 🚨

- No tests for enhancers directly
- memo and trace enhancers mentioned but not implemented
- Enhancer propagation through views is hacky (recreating factories)

8. Component Factory Return Type ⚠️

The component factory returns a Lattice instance with internal methods (getModel, getSelectors, etc.) that are used by adapters but not meant to be
  public. This violates encapsulation.

9. View Selector Function Confusion ⚠️

Views support a "selector" parameter that filters properties:

viewFactory<S extends Partial<T>>(selector?: (base: T) => S)

But this is easily confused with the selectors concept, and the naming is poor.

10. Missing Runtime Validation 🚨

Despite claims of "type-safe contracts", there's no runtime validation:
- No checks that adapters provide correct tools
- No validation of factory return values
- No guards against incorrect enhancer usage

Recommendations

1. Fix View API: Make views directly callable or change the adapter API
2. Standardize Enhancer Context: All factories should get consistent context
3. Implement Proper Memoization: Use proper identity-based caching
4. Clean Up API Overloads: Separate new/old APIs more clearly
5. Add Runtime Validation: Validate contracts at adapter boundaries
6. Clarify Architecture Claims: Be honest about what Lattice does
7. Complete Enhancer System: Implement missing enhancers with tests
8. Fix Encapsulation: Hide internal Lattice methods from public API

These issues prevent Lattice from being production-ready and could cause significant confusion for users.