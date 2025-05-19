# Factory & Composition Terminology Clarification Plan

## Implementation Status: ✅ COMPLETE

The terminology clarification plan has been fully implemented! The branding and naming now correctly match the architectural reality:

1. Objects provided to factory callbacks are now correctly branded as `*_TOOLS_BRAND`
2. Functions returned by `create*` are now correctly branded as `*_FACTORY_BRAND`
3. Helper functions have been renamed to match the new terminology (e.g., `isModelFactory`)
4. Documentation and comments have been updated to reflect the new terminology
5. Tests have been updated to match the new terminology

## Original Problem Statement (RESOLVED)

The previous terminology in Lattice's branding and type system didn't match the actual implementation architecture, causing confusion and unnecessary cognitive load:

1. ✅ FIXED: Objects provided to factory callbacks were branded as `*_FACTORY_BRAND`, but they are runtime tools
2. ✅ FIXED: Functions returned by `create*` were branded as `*_INSTANCE_BRAND`, but they are actually factories themselves
3. ✅ FIXED: The compose pattern returned unbranded factory functions (correctly), but this created an inconsistency with the branded "instances"
4. ✅ FIXED: As referenced in packages/core/src/shared/compose/core.ts:42-43, compose now "returns a simple factory function, not a ModelInstance"

## Current State (Fixed)

The factory/instance terminology has been fixed to match the architectural reality:

1. **Types.ts (lines 6-22):** 
   ```typescript
   // Tools brand symbols (previously factory brand symbols)
   export const MODEL_TOOLS_BRAND = Symbol('model-tools');
   export const SELECTORS_TOOLS_BRAND = Symbol('selectors-tools');
   export const ACTIONS_TOOLS_BRAND = Symbol('actions-tools');
   export const VIEW_TOOLS_BRAND = Symbol('view-tools');
   export const MUTATION_BRAND = Symbol('mutation-brand');
   export const COMPONENT_FACTORY_BRAND = Symbol('component-factory');
   
   // Factory brand symbols (previously instance brand symbols)
   export const MODEL_FACTORY_BRAND = Symbol('model-factory');
   export const SELECTORS_FACTORY_BRAND = Symbol('selectors-factory');
   export const ACTIONS_FACTORY_BRAND = Symbol('actions-factory');
   export const VIEW_FACTORY_BRAND = Symbol('view-factory');
   export const COMPONENT_FACTORY_INSTANCE_BRAND = Symbol('component-factory-instance');
   ```

2. **Creation functions (e.g., model/create.ts:48-72):**
   ```typescript
   export function createModel<T>(sliceFactory: ModelSliceFactory<T>) {
     // Create a factory function that returns a slice creator
     const modelFactory = function modelFactory() {
       return (options: StoreFactoryTools<T>) => {
         // ...
         // Create a branded tools object for the factory
         const tools = brandWithSymbol(
           {
             set: options.set,
             get: options.get,
           },
           MODEL_TOOLS_BRAND
         );
         // ...
       };
     };

     return brandWithSymbol(modelFactory, MODEL_FACTORY_BRAND);
   }
   ```

3. **Types.ts (lines 247-269):** Now uses correct terminology:
   ```typescript
   export type BrandedModelTools<T> = Branded<
     StoreFactoryTools<T>,
     typeof MODEL_TOOLS_BRAND
   >;

   export type ModelFactory<T> = Branded<
     () => (options: StoreFactoryTools<T>) => T,
     typeof MODEL_FACTORY_BRAND
   >;
   ```

4. **Identification helpers (instance.ts):**
   ```typescript
   export function isModelFactory<T = unknown>(
     value: unknown
   ): value is ModelFactory<T> {
     return isBranded(value, MODEL_FACTORY_BRAND);
   }
   ```

The result is a clear and accurate mental model where:
- What users write are properly referred to as "slice factories"
- What users get back are called "factories", which is what they actually are
- Tools for working with models are properly branded as tools, not factories
- Composed objects maintain consistent branding and terminology

## Achieved Goals ✅

The terminology has been updated to match the implementation architecture:

1. **User-provided Functions:** ✅ Now correctly called "slice factories" (they create slices of state/behavior)
   ```typescript
   // What users write
   const counterSliceFactory = ({ set, get }) => ({
     count: 0,
     increment: () => set((state) => ({ count: state.count + 1 }))
   });
   ```

2. **Runtime Tools:** ✅ Now correctly branded as `*_TOOLS_BRAND` (not `*_FACTORY_BRAND`)
   ```typescript
   export const MODEL_TOOLS_BRAND = Symbol('model-tools');
   // Used with tools objects provided to slice factories
   ```

3. **Creation Function Results:** ✅ Now correctly branded as `*_FACTORY_BRAND` (not `*_INSTANCE_BRAND`)
   ```typescript
   export function createModel<T>(sliceFactory: ModelSliceFactory<T>) {
     // Return a branded factory function
     return brandWithSymbol(modelFactory, MODEL_FACTORY_BRAND);
   }
   ```

4. **Final Objects:** ✅ Now correctly called "instances" (created when factories are invoked)
   ```typescript
   // The actual runtime object
   const counterInstance = counterFactory({ get, set });
   ```

This aligns with the actual three-phase architecture:
1. **Definition Phase:** User defines slice factories
2. **Composition Phase:** Factories are combined with `compose().with()`
3. **Instantiation Phase:** Factories create runtime objects when invoked with tools

## Implementation Checklist (All phases completed!)

### Phase 0: Test Coverage ✅

- [x] Ensure complete test coverage for fluent composition API
- [x] Implement standalone test files for each component type:
  - [x] `model/create.test.ts` 
  - [x] `actions/create.test.ts`
  - [x] `selectors/create.test.ts`
  - [x] `view/create.test.ts`
- [x] Verify all tests pass with the current terminology

### Phase 1: Symbol Renaming ✅

- [x] Rename `MODEL_FACTORY_BRAND` to `MODEL_TOOLS_BRAND` in `types.ts:7`
- [x] Rename `SELECTORS_FACTORY_BRAND` to `SELECTORS_TOOLS_BRAND` in `types.ts:8`
- [x] Rename `ACTIONS_FACTORY_BRAND` to `ACTIONS_TOOLS_BRAND` in `types.ts:9`
- [x] Rename `VIEW_FACTORY_BRAND` to `VIEW_TOOLS_BRAND` in `types.ts:10`
- [x] Rename `MODEL_INSTANCE_BRAND` to `MODEL_FACTORY_BRAND` in `types.ts:15`
- [x] Rename `SELECTORS_INSTANCE_BRAND` to `SELECTORS_FACTORY_BRAND` in `types.ts:16`
- [x] Rename `ACTIONS_INSTANCE_BRAND` to `ACTIONS_FACTORY_BRAND` in `types.ts:17`
- [x] Rename `VIEW_INSTANCE_BRAND` to `VIEW_FACTORY_BRAND` in `types.ts:18`
- [x] Rename `COMPONENT_INSTANCE_BRAND` to `COMPONENT_FACTORY_INSTANCE_BRAND` in `types.ts:19`

### Phase 2: Type Renaming ✅

- [x] Rename `BrandedModelFactoryTools` to `BrandedModelTools` in `types.ts:246-249`
- [x] Rename `BrandedSelectorsFactoryTools` to `BrandedSelectorsTools` in `types.ts:250-253`
- [x] Rename `BrandedActionsFactoryTools` to `BrandedActionsTools` in `types.ts:254-257`
- [x] Rename `BrandedViewFactoryTools` to `BrandedViewTools` in `types.ts:258-261`
- [x] Rename `ModelInstance` to `ModelFactory` in `types.ts:266-269`
- [x] Rename `SelectorsInstance` to `SelectorsFactory` in `types.ts:270-273`
- [x] Rename `ActionsInstance` to `ActionsFactory` in `types.ts:274-277`
- [x] Rename `ViewInstance` to `ViewFactory` in `types.ts:286-289`
- [x] Rename `BaseInstance` to `BaseFactory` in `types.ts:292-296` and update union type members

### Phase 3: Interface and Type Parameter Updates ✅

- [x] Create a new `ModelSliceFactory` type in `types.ts` to represent user-provided slice factories
- [x] Create new types for other slice factories (`SelectorsSliceFactory`, `ActionsSliceFactory`, etc.)
- [x] Update the existing `ModelFactory` type to represent what users directly write
- [x] Update parameter names in function signatures to reflect slice factory terminology
- [x] Update generic type parameter names for clarity

### Phase 4: Function Signatures and Implementation Updates ✅

- [x] Update function signatures in `core.ts` to use new type names
- [x] Update `composeWith` implementation to reference new brand names
- [x] Update function signatures in `fluent.ts` to use new type names
- [x] Update `createModel` in `create.ts` to use new branding names and parameter names
- [x] Update all other create* functions in similar ways:
  - [x] `createActions` in `actions/create.ts`
  - [x] `createSelectors` in `selectors/create.ts`
  - [x] `createView` in `view/create.ts`
  - [x] `createComponent` in `component/create.ts`

### Phase 5: Helper and Utility Functions ✅

- [x] Update identify helper functions to use new terminology:
  - [x] Rename `isModelInstance` to `isModelFactory`
  - [x] Rename `isSelectorsInstance` to `isSelectorsFactory`
  - [x] Rename `isActionsInstance` to `isActionsFactory`
  - [x] Rename `isViewInstance` to `isViewFactory`
  - [x] Add new helper functions like `isModelTools` (in factory.ts)

### Phase 6: Update Documentation and Comments ✅

- [x] Update JSDoc comments in `create.ts` to use new terminology
- [x] Update JSDoc comments in `core.ts` to use new terminology
- [x] Update JSDoc comments in `fluent.ts` to use new terminology
- [x] Update comments throughout the codebase to use consistent terminology
- [x] Update documentation in docs/spec.md to reflect new terminology

### Phase 7: Test Updates ✅

- [x] Update tests in `model/create.ts` to reflect new terminology
- [x] Update tests in `actions/create.test.ts` to use new terminology
- [x] Update tests in `selectors/create.test.ts` to use new terminology
- [x] Update tests in `view/create.test.ts` to use new terminology
- [x] Update tests in `core.ts` to use new type names and branding
- [x] Update tests in `fluent.ts` to use new terminology
- [x] Update tests in `slice.integration.test.ts` to use new terminology
- [x] Update any other tests that rely on the old terminology

All tests now test against the new terminology and properly validate the branding against the correct symbols.

### Phase 8: Documentation and Examples ✅

- [x] Update examples in docs/spec.md to use new terminology:
  - [x] Definition phase examples
  - [x] Composition phase examples
  - [x] Instantiation phase examples
- [x] Update README.md examples to reflect new terminology
- [x] Add clear explanations of the three-phase architecture

## Migration Strategy (Completed)

The implementation was completed in the following phases:

1. ✅ **Phase A:** Added new symbols and types with deprecation notes on old ones
2. ✅ **Phase B:** Updated implementations to use new terminology internally
3. ✅ **Phase C:** Maintained backward compatibility where needed (e.g., ComponentFactoryInstance)
4. ✅ **Phase D:** Fully migrated to new terminology in a clean implementation

## Conclusion

The branding terminology clarification project has been successfully completed! The codebase now uses clear, accurate terminology that matches the actual implementation architecture:

1. What users write are properly referred to as "slice factories"
2. Runtime tools are correctly branded as `*_TOOLS_BRAND` 
3. Factory functions are correctly branded as `*_FACTORY_BRAND`
4. Final objects are properly referred to as "instances"

This has significantly improved the clarity and maintainability of the codebase, making it easier for developers to understand the three-phase architecture (definition → composition → instantiation).

The tests added for the fluent composition API during this process also ensure that the composition API works correctly and maintains proper branding.

## References

- `packages/core/src/shared/types.ts`: Main type definitions with updated symbols and types
- `packages/core/src/shared/compose/core.ts`: Core composition logic with updated branding
- `packages/core/src/shared/compose/fluent.ts`: Fluent composition API with proper type signatures
- `packages/core/src/model/create.ts`: Model creation with updated branding
- `packages/core/src/actions/create.ts`: Actions creation with updated branding
- `packages/core/src/selectors/create.ts`: Selectors creation with updated branding
- `packages/core/src/view/create.ts`: View creation with updated branding
- `packages/core/src/shared/identify/factory.ts`: New helper functions for tools identification
- `packages/core/src/shared/identify/instance.ts`: Updated helpers for factory identification
- `docs/spec.md`: Main specification document with updated terminology