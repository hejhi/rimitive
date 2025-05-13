# Lattice Implementation Prompts

These prompts provide self-contained instructions to implement each part of the Lattice functionality.

### 1. Core Type Definitions and Branding

Create core type definitions for the Lattice module. Define the `LatticeLike` interface with all its generic parameters (TModel, TState, TActions, TViews) and `Lattice` branded type. Include appropriate JSDoc comments and type constraints. Refer to `/packages/core/src/shared/types/index.ts` for the Branded type utility pattern and other existing branded types. Also create the export constants needed for branding, such as `LATTICE_BRAND = Symbol('lattice')`.

### 2. Type Guards Implementation

Implement type guard functions for Lattice instances. Create an `isLattice` function that checks if an unknown value is a valid Lattice instance. This should follow the pattern in `/packages/core/src/shared/identify/index.ts` for other instance type guards, using the `isLatticeObject` utility with the appropriate brand symbol. Include in-source tests to verify the type guard works correctly.

### 3. Component Resolution Utilities

Create utilities for resolving components when either a prepared component or a lattice is provided. Implement `resolveComponent` to extract model, state, or actions from a lattice if a lattice is provided, otherwise return the component directly. Similarly implement `resolveView` to extract either a specific view or all views from a lattice. These utilities will be used by the createLattice function to support pass-through composition. Reference the existing patterns in `/packages/core/src/shared/identify/index.ts`.

### 4. View Composition Utilities

Implement view utilities for lattice composition. Create the `use` function that extracts a specific named view from a lattice, and the `spreadViews` function that returns an object containing all views from a lattice. These utilities enable composing views from different lattices. Ensure proper type safety with generic type parameters to preserve the exact view types. Include in-source tests to verify the utilities work correctly for different view combinations.

### 5. Component Validation Utilities

Create utility functions to validate that lattice components are properly prepared before use. Implement `validatePreparedComponent` to check if a component is prepared using `isPrepared` from the shared utilities and is of the correct type (model, state, actions, view) using the appropriate type guard function. Reference `/packages/core/src/shared/compose/prepare.ts` for the `isPrepared` function pattern.

### 6. Context Checking Module

Implement the context tracking system to ensure runtime tools are used only in appropriate contexts. Create a `DeriveContext` object with flags (`inState`, `inView`) and methods to check and set context state (`checkState`, `runInState`). Similarly, implement `DispatchContext` and `MutateContext`. These will be used to enforce that derive/dispatch/mutate are only used in the correct component creation phases.

### 7. Callsite Analysis Utility

Create the `checkDirectPropertyAssignment` utility to detect and prevent misuse of runtime tools in nested functions. This function should examine the call stack to ensure tools like derive, dispatch, and mutate are used directly as property values and not inside nested functions or methods. The utility should throw descriptive error messages when misuse is detected.

### 8. Derive Tool Implementation

Implement the `derive` function that creates reactive subscriptions between sources and consumers. The function should accept a source object, key, and optional transform function. It should validate usage context using the DeriveContext, prevent nested usage with checkDirectPropertyAssignment, and connect to Zustand's subscribe mechanism. Add appropriate JSDoc comments and type definitions. Reference the existing factory tool interfaces in `/packages/core/src/shared/types/index.ts`.

### 9. Dispatch Tool Implementation

Implement the `dispatch` function that connects view event handlers to actions. The function should take an actions object and action name, validate the usage context (only in view creation), prevent nested usage, and return a function that delegates to the specified action. Include proper type definitions to preserve the action's parameter and return types. Reference the ViewFactoryTools interface in `/packages/core/src/shared/types/index.ts`.

### 10. Mutate Tool Implementation

Implement the `mutate` function that connects actions to model methods. The function should take a model and method name, validate the usage context (only in actions creation), prevent nested usage, and return a function that delegates to the specified model method. Include proper type definitions to preserve the method's parameter and return types. Reference the ActionsFactoryTools interface in `/packages/core/src/shared/types/index.ts`.

### 11. CreateLattice Function

Implement the `createLattice` function with the new enhanced API. The function should accept a components object that allows either prepared components or entire lattices for each of model, state, actions, and view. It should use the resolution utilities to extract components from lattices when needed, validate all components are properly prepared, apply branding, and return a complete lattice object. Support a mix of new components and pass-through from existing lattices. Include proper type definitions and JSDoc comments.

### 12. InstantiateLattice Function

Implement the `instantiateLattice` function that creates a runtime instance of a lattice. This framework-agnostic function should create a Zustand store using the model as initial state, wire up the derive/dispatch/mutate relationships, and return an object with the core store and accessor methods. This will serve as the foundation that framework-specific adapters (React, Vue, etc.) can build upon. Include proper type definitions and JSDoc comments.

### 13. Integration Tests for Component Resolution

Create a test suite for the component resolution utilities. Test extracting components from lattices; test handling prepared components directly; test extracting specific and all views; and test type safety of the resolution process. Use the in-source testing approach with Vitest as used in other parts of the codebase.

### 14. Integration Tests for View Utilities

Create tests for the view composition utilities. Test the `use` function for extracting specific views; test the `spreadViews` function for extracting all views; test combining views from multiple lattices; and test error handling when views don't exist. Use the in-source testing approach with Vitest.

### 15. Integration Tests for Lattice Creation

Create a comprehensive test suite for lattice creation with the new API. Test creating a lattice with prepared components; test creating a lattice with components from existing lattices; test mixing prepared components and lattice pass-through; test view composition with use and spreadViews; and test validation of unprepared components. Use the in-source testing approach with Vitest.

### 16. Integration Tests for Runtime Tools

Create tests for the derive, dispatch, and mutate runtime tools. Test proper usage in allowed contexts; test error conditions when used incorrectly; test reactivity of derive; test proper delegation of dispatch and mutate. Use the in-source testing approach with Vitest as used in other parts of the codebase.

### 17. Integration Tests for Lattice Instantiation

Create tests for the instantiateLattice function. Test creation of a Zustand store; test proper wiring of components; test initialization with custom initial state; test multiple independent instances; test working with views composed from multiple sources. Use the in-source testing approach with Vitest as used in other parts of the codebase.

### 18. Index File for Lattice Module

Create the main index.ts file for the lattice module that exports all public APIs. Include the core types, creation and composition functions, runtime tools, view utilities, and instantiation function. Organize exports logically and include proper JSDoc comments for exported items. Reference the index.ts pattern in other modules like `/packages/core/src/model/index.ts`.

### 19. Example Implementation Documentation

Create example documentation showing how to use the new lattice API. Include examples of creating a simple lattice with prepared components, creating a lattice with components from existing lattices, using view utilities for composition, and instantiating lattices for use. These examples should be included as JSDoc comments in the code and/or in a separate markdown file in the lattice directory.

### 20. CLAUDE.md for Lattice Module

Create a CLAUDE.md file for the lattice module that provides guidance for Claude when working with the lattice code. Explain the key concepts, composition patterns, component resolution approach, and view composition utilities. Highlight common patterns and potential pitfalls when working with the lattice API. This will help Claude understand the design philosophy and implementation details when assisting with lattice-related tasks.