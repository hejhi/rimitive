# Implementation Plan for Lattice

## TDD Methodology Instructions

Before beginning any implementation task, follow these strict Test-Driven
Development (TDD) principles:

1. **Read First**: Always review the relevant sections of the
   [spec](./draft-spec.md) before starting on any task, and the
   [`package.json`](../package.json) to understand the available commands.

2. **Red-Green-Refactor Cycle**:
   - **RED**: Pick a task and write a failing test that defines the expected
     behavior.
   - **GREEN**: Write the minimal implementation to make the test pass
   - **REFACTOR**: Clean up the code while keeping tests passing
   - **STOP**: Update the implementation plan with your progress and provide the
     user with a prompt they can provide to another LLM with a summary of what
     you did and instructions for the LLM on next steps, in the form of a
     concise but thorough markdown-free paragraphs, with any relevant file
     references.

3. **Test Organization**:
   - Place tests in the [tests](../packages/core/src/tests/) directory
   - Name test files matching their implementation counterparts with the pattern
     `*.test.ts`
   - Use descriptive test names that explain the behavior being tested

4. **Testing Principles**:
   - Test behavior, not implementation details
   - Ensure proper type checking is tested
   - Test both success and error cases
   - Maintain test isolation

5. **Implementation Guidelines**:
   - Focus on making the current test pass
   - Avoid implementing features not covered by tests
   - Follow TypeScript best practices
   - Maintain clean separation of concerns

Keep your code:

- atomic and modular
- flat
- declarative
- functional
- easy to reason about

Rules:

- DO NOT OVERFIT TESTS TO IMPLEMENTATION OR VICE VERSA.
- DO NOT USE `any` AS A TYPE, AND STRICTLY AVOID TYPE CASTING WHEREVER POSSIBLE.
- LEVERAGE ZUSTAND TYPES AND TYPESCRIPT GENERICS AND INFERENCE WHEREVER
  POSSIBLE.

## Iteration 1: Core Model Foundation

- [x] **Task 1.1: Project Setup**
  - Create basic package structure
  - Configure TypeScript, ESLint, and test framework (Vitest)
  - Implement basic build pipeline

- [x] **Task 1.2: Zustand Integration** (ref: Section 1. Introduction)
  - Create wrapper for Zustand store creation
  - Ensure proper type inference

- [x] **Task 1.3: Basic Model Factory** (ref: Section 3. Building Blocks -
      Model)
  - Implement `createModel` function with double-function pattern
  - Test basic state creation and access
  - Verify type inference for model properties

- [x] **Task 1.4: Model State Mutations** (ref: Section 3. Building Blocks -
      Model)
  - Test state mutation methods
  - Implement state setter functionality
  - Verify proper state updates

- [x] **Task 1.5: Model State Selectors** (ref: Section 3. Building Blocks -
      Model)
  - Test state selector methods
  - Implement getter functionality
  - Verify proper state selection

- [x] **Task 1.6: Model Type Safety** (ref: Section 3. Building Blocks - Model)
  - Test type safety for model creation
  - Ensure proper TypeScript inference
  - Verify proper compile-time errors for invalid models

## Iteration 2: Composition System

- [ ] **Task 2.1: Model Composition** (ref: Section 3. Building Blocks - Model
      Composition)
  - Implement basic model composition
  - Test composing two independent models
  - Verify state and method access across composition

- [ ] **Task 2.2: Selective Composition** (ref: Section 5. Composition Patterns)
  - Implement selective property composition
  - Test cherry-picking specific properties
  - Verify only selected properties are accessible

- [ ] **Task 2.3: Contract Preservation** (ref: Section 5. Composition Patterns)
  - Implement contract checking for compositions
  - Test enforcement of base model contracts
  - Verify proper TypeScript errors for contract violations

- [ ] **Task 2.4: Factory Creation Pattern** (ref: Section 5. Composition
      Patterns)
  - Test factory creation without premature instantiation
  - Verify proper type preservation
  - Ensure factories are only evaluated when used

## Iteration 3: Actions System

- [ ] **Task 3.1: Basic Actions Factory** (ref: Section 3. Building Blocks -
      Actions)
  - Implement `createActions` function with double-function pattern
  - Test basic action creation with `mutate`
  - Verify proper type inference

- [ ] **Task 3.2: Action Composition** (ref: Section 3. Building Blocks -
      Actions)
  - Implement action composition from other actions
  - Test selecting actions from base actions
  - Verify proper delegation to model methods

- [ ] **Task 3.3: Action Dispatch** (ref: Section 7. Advanced Topics - Direct
      Action Dispatch)
  - Test action dispatch to model methods
  - Verify proper parameter passing
  - Ensure one-way data flow

## Iteration 4: State and Derived Values

- [ ] **Task 4.1: Basic State Factory** (ref: Section 3. Building Blocks -
      State)
  - Implement `createState` function with double-function pattern
  - Test basic state selection
  - Verify proper type inference

- [ ] **Task 4.2: State Derivation** (ref: Section 6. The Derive System)
  - Implement `derive` function for creating reactive subscriptions
  - Test deriving state from model properties
  - Verify reactive updates to derived state

- [ ] **Task 4.3: State Composition** (ref: Section 6. The Derive System)
  - Implement state composition from other states
  - Test selecting state from base states
  - Verify proper type preservation

- [ ] **Task 4.4: State Transformation** (ref: Section 6. The Derive System)
  - Test transformation functions in derive
  - Verify proper reactivity with transformations
  - Ensure type safety for transformations

## Iteration 5: Views System

- [ ] **Task 5.1: Basic View Factory** (ref: Section 3. Building Blocks - View)
  - Implement `createView` function with double-function pattern
  - Test basic view attributes
  - Verify proper type inference

- [ ] **Task 5.2: View Derivation** (ref: Section 3. Building Blocks - View)
  - Implement view derivation from state
  - Test deriving view properties from state
  - Verify reactive updates to view attributes

- [ ] **Task 5.3: View Action Binding** (ref: Section 3. Building Blocks - View)
  - Implement `dispatch` function for binding actions
  - Test event handler creation
  - Verify proper action dispatch

- [ ] **Task 5.4: View Composition** (ref: Section 3. Building Blocks - View)
  - Implement view composition from other views
  - Test selecting view attributes
  - Verify proper merging of view attributes

- [ ] **Task 5.5: View Merging** (ref: Section 3. Building Blocks - View)
  - Implement `mergeViews` function
  - Test merging multiple views
  - Verify proper attribute precedence

## Iteration 6: Complete Lattice

- [ ] **Task 6.1: Lattice Creation** (ref: Section 4. Progressive Examples)
  - Implement `createLattice` function
  - Test creating a complete lattice with model, actions, state, and view
  - Verify proper instance creation

- [ ] **Task 6.2: Lattice Composition** (ref: Section 5. Composition Patterns)
  - Implement `withLattice` helper for composing lattices
  - Test composing a lattice from a base lattice
  - Verify proper extension of the base contract

- [ ] **Task 6.3: Simple Counter Example** (ref: Section 4. Progressive
      Examples)
  - Implement complete counter example
  - Test all counter interactions
  - Verify proper operation of the full lattice

## Iteration 7: Advanced Features

- [ ] **Task 7.1: Async Operations** (ref: Section 7. Advanced Topics -
      Asynchronous Operations)
  - Implement async operation pattern
  - Test loading and error states
  - Verify proper state transitions during async operations

- [ ] **Task 7.2: Complex Composition Example** (ref: Section 4. Progressive
      Examples)
  - Implement complex composition example
  - Test selective feature composition
  - Verify proper operation of composed lattices

- [ ] **Task 7.3: Lazy Loading** (ref: Section 2. Factory-Based Composition)
  - Implement dynamic importing of lattice enhancements
  - Test lazy-loaded feature composition
  - Verify proper operation after dynamic loading

- [ ] **Task 7.4: Framework Adapters** (ref: Section 1. Introduction)
  - Implement React adapter with hooks
  - Test React component integration
  - (Optional) Implement Vue adapter

## Iteration 8: Documentation and Examples

- [ ] **Task 8.1: API Documentation**
  - Create comprehensive API docs
  - Include type definitions
  - Document common patterns

- [ ] **Task 8.2: Usage Examples**
  - Create example applications
  - Document practical use cases
  - Provide comparison with plain hooks

- [ ] **Task 8.3: Performance Optimization**
  - Add memoization where appropriate
  - Test performance characteristics
  - Document performance considerations
