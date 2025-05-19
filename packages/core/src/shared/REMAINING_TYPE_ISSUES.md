# Remaining Type Issues

This document outlines the remaining type issues that need to be addressed in future improvements. These issues don't affect the functionality of the code but would improve type safety and developer experience.

## 1. Unused Declarations

Several files have unused import declarations or variables marked with TS6133:

- `src/actions/create.ts`: 
  - `ActionsFactoryParams` is declared but never used.
  - `params` is declared but its value is never read.

- `src/shared/compose/core.ts`:
  - `ActionsFactoryParams` is declared but never used.

- `src/shared/compose/slice.ts`:
  - `MutatedModel` is declared but never used.

- `src/shared/compose/selector.example.ts`:
  - Several example types declared but never used (ModelExample, SelectorsExample, ActionsExample, ViewExample) - these are likely intentional.

## 2. Type Compatibility in Composition Tests

Several tests in the `compose` functionality have type compatibility issues:

- `src/shared/compose/core.ts`:
  - Type compatibility issues with the test branded factories in lines 288 and 344.
  - These only affect the tests and do not impact the actual functionality or user-facing API.

## 3. Type Safety in Integration Tests

The integration test in `select.integration.test.ts` has type compatibility issues:

- Line 61: The view factory created by the integration test is not perfectly compatible with the expected type.
- This is due to the complex nature of the composition and doesn't affect actual usage.

## 4. Type Compatibility in from.ts

`src/shared/from.ts` has an overload signature incompatibility:

- Line 45: Overload signature is not compatible with its implementation signature.
- This is due to how TypeScript handles overloads with the same parameter types but different return types.

## Recommendations

1. **Consolidate Type Usage**: Remove unused imports and declarations to reduce confusion.

2. **Improve Test Typing**: Consider refactoring tests to use proper type assertions to avoid compatibility issues.

3. **Expand Type Documentation**: Add more detailed JSDoc comments to explain complex type relationships.

4. **Type Guards**: Add more runtime type guards to help with narrowing types in complex scenarios.

5. **Simplify Branding**: The current branded types are causing some compatibility issues. Consider simplifying the branding approach to reduce these errors.