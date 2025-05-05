# Lattice Implementation Plan

This document outlines the TDD-based implementation plan for the Lattice
framework. Each iteration is broken down into atomic tasks with corresponding
test cases. Reference the [spec](./draft-spec.md) to resolve ANY ambiguity, and
keep the test cases and iterations aligned to it EXACTLY. The sources-of-truth
chain are as follows:

`spec -> test cases -> implementations`

Follow a STRICT TDD methodology, creating test cases from the tasks before
starting ANY implementations.

There are two packages in the repo:

- [`core`](../packages/core): contains all the code
- [`examples`](../packages/examples): contains various examples (starting with
  vanilla)

This is a monorepo with `pnpm` and `lerna`. Important commands:

- `pnpm test`: run tests
- `pnpm typecheck`: run type checking

## Rules: !IMPORTANT!

- Before beginning any iteration, ALWAYS analyze the spec thoroughly and
  cross-reference the tasks to it to make sure everything is aligned. If you
  find deltas, STOP and flag it to the user.
- When beginning an iteration, begin by writing ALL the tests from the tasks,
  ensuring that they FAIL for the RIGHT reasons. STOP after you write all the
  tests for an iteration. All tests go in the
  [tests](../packages/core/src/tests) directory.
- Run tests FREQUENTLY, and never move onto a new implementation if tests are
  failing, unless the user asks you to.

## Iteration 1: Core Foundation - State & Model

Build the foundation for state management and model creation.

### Tasks

| ID  | Task Description                       | Unit Test Case                                                         | Status |
| --- | -------------------------------------- | ---------------------------------------------------------------------- | ------ |
| 1.1 | Implement `withStoreSubscribe` utility | Test that it correctly subscribes to a Zustand store and selects state | ✅     |
| 1.2 | Implement `createModel` core function  | Test that it creates a model with getters                              | ✅     |
| 1.3 | Add mutation methods to model          | Test that mutations correctly update state                             | ✅     |
| 1.4 | Implement subscription chaining        | Test multiple store subscriptions work correctly                       | ✅     |
| 1.5 | Add state selection                    | Test that selected state is passed to model methods                    | ✅     |

### Integration Tests

- Create a simple counter model with state and verify reactivity ✅
- Combine multiple state stores with dependent values and verify correct updates
  ✅

## Iteration 2: Actions & Basic Composition

Implement the Actions layer and basic composition patterns.

### Tasks

| ID  | Task Description                       | Unit Test Case                                    | Status |
| --- | -------------------------------------- | ------------------------------------------------- | ------ |
| 2.1 | Implement basic actions object pattern | Test actions correctly call model methods         | ✅     |
| 2.2 | Add support for action parameters      | Test parameter passing through actions to model   | ✅     |
| 2.3 | Implement action composition           | Test composition of actions from multiple sources | ✅     |
| 2.4 | Add event handling in actions          | Test action methods handling DOM events           | ✅     |
| 2.5 | Implement error handling in actions    | Test error handling and recovery in action chain  | ✅     |

### Integration Tests

- Create a todo list with actions for adding/toggling todos ✅
- Build a filtering system with state-based and action-based filtering ✅

## Iteration 3: View System

Implement the reactive View layer for UI attributes.

### Tasks

| ID  | Task Description                | Unit Test Case                                | Status |
| --- | ------------------------------- | --------------------------------------------- | ------ |
| 3.1 | Implement `createView` function | Test creating a basic view with namespace     | ⬜     |
| 3.2 | Implement `composeFrom` utility | Test composing view from model selectors      | ⬜     |
| 3.3 | Add action mapping in views     | Test mapping action methods to event handlers | ⬜     |
| 3.4 | Implement `mergeViews` utility  | Test merging multiple views together          | ⬜     |
| 3.5 | Add parameter passing in views  | Test view methods receiving parameters        | ⬜     |

### Integration Tests

- Create a counter UI with increment/decrement views
- Build a todo list with item views and list container views

## Iteration 4: Hooks System

Implement the Hooks system for cross-cutting concerns.

### Tasks

| ID  | Task Description                     | Unit Test Case                              | Status |
| --- | ------------------------------------ | ------------------------------------------- | ------ |
| 4.1 | Implement `createHooks` function     | Test creating basic before/after hooks      | ⬜     |
| 4.2 | Add argument transformation in hooks | Test transforming arguments in before hooks | ⬜     |
| 4.3 | Add result transformation in hooks   | Test transforming results in after hooks    | ⬜     |
| 4.4 | Implement hook cancellation          | Test preventing method execution with hooks | ⬜     |
| 4.5 | Implement `mergeHooks` utility       | Test merging multiple hook objects          | ⬜     |

### Integration Tests

- Add logging hooks to a counter model
- Implement validation hooks for a form model

## Iteration 5: Lattice Composition

Implement the Lattice composition layer.

### Tasks

| ID  | Task Description                           | Unit Test Case                               | Status |
| --- | ------------------------------------------ | -------------------------------------------- | ------ |
| 5.1 | Implement `createLattice` function         | Test creating a simple lattice               | ⬜     |
| 5.2 | Add lattice composition with `withLattice` | Test extending a base lattice                | ⬜     |
| 5.3 | Implement lattice hooks integration        | Test hooks working across composed lattices  | ⬜     |
| 5.4 | Add view composition in lattices           | Test view composition with multiple lattices | ⬜     |
| 5.5 | Implement lattice instance isolation       | Test multiple instances with separate state  | ⬜     |

### Integration Tests

- Create a tree component by composing selection and expansion lattices
- Build a data grid with sorting, filtering, and pagination lattices

## Iteration 6: Framework Integration

Implement adapters for React and potentially other frameworks.

### Tasks

| ID  | Task Description                              | Unit Test Case                                  | Status |
| --- | --------------------------------------------- | ----------------------------------------------- | ------ |
| 6.1 | Implement React hooks for model access        | Test React components using model state         | ⬜     |
| 6.2 | Add React hooks for view binding              | Test spreading view props on React elements     | ⬜     |
| 6.3 | Implement React actions binding               | Test components triggering actions              | ⬜     |
| 6.4 | Add memoization and performance optimizations | Test that components only re-render when needed | ⬜     |
| 6.5 | Create helper hooks for common patterns       | Test simplified usage patterns                  | ⬜     |

### Integration Tests

- Create a fully functional React todo app with Lattice
- Build a complex tree view component with drag and drop

## Development Workflow

1. For each iteration:
   - Create a new conversation with the LLM
   - Have the LLM implement tests for all tasks in the iteration
   - Implement code to make tests pass, one task at a time
   - Update status in this document as tasks are completed

2. For each task:
   - Write the test first (TDD)
   - Implement the minimal code to make the test pass
   - Refactor while keeping tests green
   - Move to the next task

3. If a conversation reaches context limits:
   - Update this document with progress
   - Create a new conversation to continue

## Status Legend

- ⬜ Not Started
- 🟡 In Progress
- ✅ Completed
- ❌ Blocked

## Dependencies

- Iteration 2 depends on Iteration 1
- Iteration 3 depends on Iterations 1 and 2
- Iteration 4 depends on Iterations 1 and 2
- Iteration 5 depends on Iterations 1-4
- Iteration 6 depends on Iterations 1-5
