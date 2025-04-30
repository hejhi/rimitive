# Changelog

## [0.1.0] - 2025-05-10

### Added

#### Core Foundations

- Established type system for the Lattice framework [packages/core/src/types.ts]
- Implemented atomic store fundamentals following Phase 0.1 of TDD plan
  [packages/core/src/tests/atomic-store.test.ts]
- Added store independence tests per Phase 0.2
  [packages/core/src/tests/store-independence.test.ts]

#### API Implementation

- Created the `createAPI` function that returns both API and hooks system
  [packages/core/src/api.ts:38-46]
- Implemented reactive getter/setter store pattern as specified in the spec
  [packages/core/src/api.ts]
- Added enhanced get function with dependency handling
  [packages/core/src/api.ts:48-73]
- Implemented state property extraction [packages/core/src/api.ts:79-93]

#### Hooks System

- Added before/after hooks system integrated with API methods
  [packages/core/src/api.ts:144-166]
- Implemented hook registration with chainable API
  [packages/core/src/api.ts:202-218]
- Added cancellation capability in before hooks
  [packages/core/src/api.ts:149-154]

#### Props System

- Implemented `createProps` function that returns ready-to-spread UI attributes
  [packages/core/src/props.ts:16-62]
- Added support for reactive props that update when underlying API state changes
  [packages/core/src/props.ts:21-47]
- Created `mergeProps` helper for composing props from multiple sources
  [packages/core/src/props.ts:71-93]
- Ensured merged props maintain reactivity to all source stores
  [packages/core/src/tests/props.test.ts:82-174]
- Implemented proper precedence where latter props override earlier ones
  [packages/core/src/props.ts:88-89]

#### Lattice System

- Implemented `createLattice` function that bundles API, hooks, and props
  [packages/core/src/lattice.ts:9-31]
- Added basic plugin system with `.use()` method for lattice composition
  [packages/core/src/lattice.ts:23-25]
- Verified proper lattice structure and plugin application
  [packages/core/src/tests/create-lattice.test.ts:11-85]

#### Type Safety

- Implemented strongly typed interfaces for API creation
  [packages/core/src/types.ts:175-185]
- Added type-safe hook system [packages/core/src/types.ts:54-61]
- Created utility types for state and method extraction
  [packages/core/src/types.ts:34-38]
- Defined types for props factory and merging
  [packages/core/src/types.ts:146-153]

### Progress Summary

Completed:

- Phase 0.1: Atomic Store Fundamentals
- Phase 0.2: Store Independence
- Phase 1.1: Basic API Store
- Phase 1.2: Enhanced API Store
- Phase 1.3: Verify API Reactivity
- Phase 1.4: Implement Hook System for API
- Phase 2.1: Basic Props Creation
- Phase 2.2: Props Reactivity
- Phase 2.3: Props Merging
- Phase 3.1: Create Lattice Constructor with Initial Design

In Progress:

- Phase 1.5: Advanced Hook System Capabilities (partially implemented)
- Phase 3.2: Implement Plugin System with .use() Method (basic implementation
  complete)

Next Up:

- Phase 3.2: Complete Plugin System Implementation
- Phase 3.3: Conditional Plugin Behavior Based on Dependencies

This initial release provides the foundation for the Lattice framework,
establishing the core Zustand store patterns and API creation system as
described in the specification. The implementation follows the reactive data
flow model where mutations update slices, and API methods provide access to
state and mutations with a hooks system for interception. The Props System has
now been implemented, which is a key innovation of Lattice that bridges state
management and UI rendering in a reactive, composable way. The Lattice System
now provides a way to bundle API, hooks, and props into a single unit that can
be composed with plugins.
