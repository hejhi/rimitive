# Factory & Composition Terminology Clarification Plan

## Problem Statement

The current terminology in Lattice's branding and type system doesn't match the actual implementation architecture, causing confusion and unnecessary cognitive load:

1. Objects provided to factory callbacks are branded as `*_FACTORY_BRAND`, but they are runtime tools
2. Functions returned by `create*` are branded as `*_INSTANCE_BRAND`, but they are actually factories themselves
3. The compose pattern returns unbranded factory functions (correctly), but this creates an inconsistency with the branded "instances"
4. As referenced in packages/core/src/shared/compose/core.ts:42-43, compose now "returns a simple factory function, not a ModelInstance"

## Current State

Currently, the factory/instance terminology is inverted from the architectural reality:

1. **Types.ts (lines 6-22):** 
   ```typescript
   // Factory brand symbols
   export const MODEL_FACTORY_BRAND = Symbol('model-factory');
   export const SELECTORS_FACTORY_BRAND = Symbol('selectors-factory');
   export const ACTIONS_FACTORY_BRAND = Symbol('actions-factory');
   export const VIEW_FACTORY_BRAND = Symbol('view-factory');
   export const MUTATION_BRAND = Symbol('mutation-brand');
   export const COMPONENT_FACTORY_BRAND = Symbol('component-factory');
   
   // Instance brand symbols
   export const MODEL_INSTANCE_BRAND = Symbol('model-instance');
   export const SELECTORS_INSTANCE_BRAND = Symbol('selectors-instance');
   export const ACTIONS_INSTANCE_BRAND = Symbol('actions-instance');
   export const VIEW_INSTANCE_BRAND = Symbol('view-instance');
   export const COMPONENT_INSTANCE_BRAND = Symbol('component-instance');
   ```

2. **Creation functions (e.g., model/create.ts:48-72):**
   ```typescript
   export function createModel<T>(factory: ModelFactory<T>) {
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
           MODEL_FACTORY_BRAND
         );
         // ...
       };
     };

     return brandWithSymbol(modelFactory, MODEL_INSTANCE_BRAND);
   }
   ```

3. **compose/core.ts (lines 42-70):** 
   ```typescript
   // When composing models, we now return a simple factory function, not a ModelInstance
   export function composeWith<B, E>(
     base: ModelInstance<B>,
     extension: (tools: ModelCompositionTools<B, E>) => E
   ): (tools: StoreFactoryTools<B & E>) => B & E;
   ```

4. **Types.ts (lines 246-296):** Uses terms like `BrandedModelFactoryTools` for runtime tools and `ModelInstance` for factory functions:
   ```typescript
   export type BrandedModelFactoryTools<T> = Branded<
     StoreFactoryTools<T>,
     typeof MODEL_FACTORY_BRAND
   >;

   export type ModelInstance<T> = Branded<
     () => (options: StoreFactoryTools<T>) => T,
     typeof MODEL_INSTANCE_BRAND
   >;
   ```

The result is a confusing mental model where:
- What users write are referred to as "factory callbacks", but are actually "slice factories"
- What users get back are called "instances", but are actually "branded factories"
- What compose returns is correctly an unbranded factory

## Desired Future State

A clearer, more accurate terminology that matches the implementation:

1. **User-provided Functions:** Should be called "slice factories" (they create slices of state/behavior)
   ```typescript
   // What users write
   const counterSliceFactory = ({ set, get }) => ({
     count: 0,
     increment: () => set((state) => ({ count: state.count + 1 }))
   });
   ```

2. **Runtime Tools:** Should be branded as `*_TOOLS_BRAND` (not `*_FACTORY_BRAND`)
   ```typescript
   export const MODEL_TOOLS_BRAND = Symbol('model-tools');
   // Used with tools objects provided to slice factories
   ```

3. **Creation Function Results:** Should be branded as `*_FACTORY_BRAND` (not `*_INSTANCE_BRAND`)
   ```typescript
   export function createModel<T>(sliceFactory: ModelSliceFactory<T>) {
     // Return a branded factory function
     return brandWithSymbol(modelFactory, MODEL_FACTORY_BRAND);
   }
   ```

4. **Final Objects:** Should be called "instances" (created when factories are invoked)
   ```typescript
   // The actual runtime object
   const counterInstance = counterFactory({ get, set });
   ```

This aligns with the actual three-phase architecture:
1. **Definition Phase:** User defines slice factories
2. **Composition Phase:** Factories are combined with `compose().with()`
3. **Instantiation Phase:** Factories create runtime objects when invoked with tools

## Implementation Checklist

### Phase 1: Symbol Renaming

- [ ] Rename `MODEL_FACTORY_BRAND` to `MODEL_TOOLS_BRAND` in `types.ts:7`
- [ ] Rename `SELECTORS_FACTORY_BRAND` to `SELECTORS_TOOLS_BRAND` in `types.ts:8`
- [ ] Rename `ACTIONS_FACTORY_BRAND` to `ACTIONS_TOOLS_BRAND` in `types.ts:9`
- [ ] Rename `VIEW_FACTORY_BRAND` to `VIEW_TOOLS_BRAND` in `types.ts:10`
- [ ] Rename `MODEL_INSTANCE_BRAND` to `MODEL_FACTORY_BRAND` in `types.ts:15`
- [ ] Rename `SELECTORS_INSTANCE_BRAND` to `SELECTORS_FACTORY_BRAND` in `types.ts:16`
- [ ] Rename `ACTIONS_INSTANCE_BRAND` to `ACTIONS_FACTORY_BRAND` in `types.ts:17`
- [ ] Rename `VIEW_INSTANCE_BRAND` to `VIEW_FACTORY_BRAND` in `types.ts:18`
- [ ] Rename `COMPONENT_INSTANCE_BRAND` to `COMPONENT_FACTORY_BRAND` in `types.ts:19`

### Phase 2: Type Renaming

- [ ] Rename `BrandedModelFactoryTools` to `BrandedModelTools` in `types.ts:246-249`
- [ ] Rename `BrandedSelectorsFactoryTools` to `BrandedSelectorsTools` in `types.ts:250-253`
- [ ] Rename `BrandedActionsFactoryTools` to `BrandedActionsTools` in `types.ts:254-257`
- [ ] Rename `BrandedViewFactoryTools` to `BrandedViewTools` in `types.ts:258-261`
- [ ] Rename `ModelInstance` to `ModelFactory` in `types.ts:266-269`
- [ ] Rename `SelectorsInstance` to `SelectorsFactory` in `types.ts:270-273`
- [ ] Rename `ActionsInstance` to `ActionsFactory` in `types.ts:274-277`
- [ ] Rename `ViewInstance` to `ViewFactory` in `types.ts:286-289`
- [ ] Rename `BaseInstance` to `BaseFactory` in `types.ts:292-296` and update union type members

### Phase 3: Interface and Type Parameter Updates

- [ ] Create a new `ModelSliceFactory` type in `types.ts` to represent user-provided slice factories
- [ ] Create new types for other slice factories (`SelectorsSliceFactory`, `ActionsSliceFactory`, etc.)
- [ ] Update the existing `ModelFactory` type (line 231) to represent what users directly write
- [ ] Update parameter names in function signatures to reflect slice factory terminology
- [ ] Update generic type parameter names for clarity

### Phase 4: Function Signatures and Implementation Updates

- [ ] Update function signatures in `core.ts:43-64` to use new type names
- [ ] Update `composeWith` implementation in `core.ts:70-127` to reference new brand names
- [ ] Update function signatures in `fluent.ts:30-52` to use new type names
- [ ] Update `createModel` in `create.ts:48-72` to use new branding names and parameter names
- [ ] Update all other create* functions in similar ways:
  - [ ] `createActions` in `actions/create.ts`
  - [ ] `createSelectors` in `selectors/create.ts`
  - [ ] `createView` in `view/create.ts`
  - [ ] `createComponent` in `component/create.ts`

### Phase 5: Helper and Utility Functions

- [ ] Update `identify.ts` helper functions to use new terminology:
  - [ ] Rename `isModelInstance` to `isModelFactory`
  - [ ] Rename `isSelectorsInstance` to `isSelectorsFactory`
  - [ ] Rename `isActionsInstance` to `isActionsFactory`
  - [ ] Rename `isViewInstance` to `isViewFactory`
  - [ ] Add new helper functions like `isModelTools` if needed

### Phase 6: Update Documentation and Comments

- [ ] Update JSDoc comments in `create.ts:9-47` to use new terminology
- [ ] Update JSDoc comments in `core.ts:18-32` to use new terminology
- [ ] Update JSDoc comments in `fluent.ts:17-29` to use new terminology
- [ ] Update comments throughout the codebase to use consistent terminology
- [ ] Update documentation in docs/spec.md to reflect new terminology

### Phase 7: Test Updates

- [ ] Update tests in `model/create.ts:74-141` to reflect new terminology
- [ ] Update tests in `core.ts:129-187` to use new type names and branding
- [ ] Update tests in `fluent.ts:69-155` to use new terminology
- [ ] Update tests in `slice.integration.test.ts` to use new terminology
- [ ] Update any other tests that rely on the old terminology

### Phase 8: Documentation and Examples

- [ ] Update examples in docs/spec.md to use new terminology:
  - [ ] Definition phase examples (lines 80-85)
  - [ ] Composition phase examples (lines 87-97)
  - [ ] Instantiation phase examples (if missing, add them)
- [ ] Update README.md examples to reflect new terminology
- [ ] Add clear explanations of the three-phase architecture

## Migration Strategy

Since this is a major change to the internals, consider implementing this in phases:

1. **Phase A:** Add new symbols and types with deprecation warnings on old ones
2. **Phase B:** Update implementations to use new terminology internally but maintain backward compatibility
3. **Phase C:** Create migration guide and tooling for consumers
4. **Phase D:** Remove deprecated symbols and types in a major version release

## References

- `packages/core/src/shared/types.ts`: Main type definitions
- `packages/core/src/shared/compose/core.ts`: Core composition logic
- `packages/core/src/shared/compose/fluent.ts`: Fluent composition API
- `packages/core/src/model/create.ts`: Model creation implementation
- `packages/core/src/actions/create.ts`: Actions creation implementation
- `packages/core/src/selectors/create.ts`: Selectors creation implementation
- `packages/core/src/view/create.ts`: View creation implementation
- `packages/core/src/component/create.ts`: Component creation implementation
- `packages/core/src/shared/identify.ts`: Type identification utilities
- `docs/spec.md`: Main specification document