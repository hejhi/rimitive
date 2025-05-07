- [x] Implement contract enforcement in the createModel factory:
  - Ensure that calling only the first phase (i.e., createModel() without the
    extension/initializer function) fails with a clear, intentional error.
  - The error should be surfaced at type level (preferred) or at runtime if not
    possible.
  - The implementation must match the Lattice spec (see docs/draft-spec.md,
    Composition and Extension Function Pattern).
  - The behavior should be verified by the existing test in
    packages/core/src/tests/composition-phase.test.ts.
  - Do not proceed to other factories until createModel is correct and the test
    passes for this case.

- [x] Implement two-phase contract enforcement for createView, createState, and
      createActions, matching the createModel pattern and spec. Ensure tests
      pass for each factory.
  - TDD Guidance: The existing tests in
    packages/core/src/tests/composition-phase.test.ts are sufficient for strict
    TDD. For each factory, follow the Red → Green loop: implement contract
    enforcement until the corresponding test passes. Only add new tests if new
    edge cases or behaviors are discovered during implementation.

- [x] Replace all `any` types in the core factories and enforcement utility with
      strong, spec-compliant TypeScript types. Ensure the API surface is fully
      typed and illegal states are unrepresentable. Use TDD/type tests as you
      go.

- [x] Implement strong type-level and runtime contract enforcement for the
      remaining Lattice core factories: createState, createActions, and
      createView.
  - Follow the exact pattern established for createModel: only branded factory
    functions (e.g., StateFactory, ActionsFactory, ViewFactory) or lattices are
    accepted as dependencies.
  - Invalid dependencies (e.g., numbers, objects, or the proxy returned by
    calling a factory) must be rejected at compile time (TypeScript error) and
    at runtime (clear, spec-compliant error message).
  - Use proxy-based enforcement to ensure the two-phase contract boundary is
    enforced at runtime, making illegal states unrepresentable.
  - No type assertions should be required for valid usage by consumers.
  - Update or add tests to verify both type-level and runtime contract
    enforcement for each factory.
  - Reference the implementation and tests for createModel as the canonical
    example.

- [x] Implement contract enforcement and type-safe composition for
      createLattice:
  - Ensure that only valid, branded factories (model, state, actions, view) are
    accepted as parts.
  - Enforce contract consistency across all parts (model, state, actions, view)
    per the Lattice spec (see docs/draft-spec.md, Factory-Based Composition and
    the Two-Phase Pattern).
  - Surface errors at type level (preferred) or at runtime if not possible.
  - Use TDD: add or update tests to verify contract enforcement and contract
    consistency for createLattice.
  - Reference the implementation and tests for the core factories as canonical
    examples.

- [x] Implement contract consistency enforcement in createLattice:
  - Ensure that all parts (model, state, actions, view) have compatible
    contracts per the Lattice spec (see docs/draft-spec.md, Factory-Based
    Composition and the Two-Phase Pattern).
  - Surface errors at type level (preferred) or at runtime if not possible.
  - Use TDD: add or update tests to verify contract consistency enforcement in
    createLattice.
  - Reference the draft-spec.md for contract rules and examples.

- [x] Write a failing test for createModel's composition phase, verifying:
  - When the optional callback is omitted, the contract from the dependency is
    passed through as-is to the extension phase.
  - When the optional callback is provided, the contract surface is shaped
    according to the callback's return type, and only those properties are
    available in the extension phase.

- [x] Implement support for the optional callback argument in createModel's
      composition phase, so that the contract is passed through as-is when
      omitted, and shaped according to the callback's return type when provided.
      Make the minimal change required to make the new tests pass.

- [x] Implement the createState factory with proper two-phase pattern and
      contract handling:
  - Follow the same pattern established for createModel
  - Ensure proper contract extraction and type safety
  - Should support the same callback composition pattern as createModel
  - Make the appropriate tests pass in create-lattice-contract.test.ts
  - Remove any temporary workarounds (like `dummyGet`) and implement a proper
    contract extraction mechanism

- [x] Fix TypeScript type errors in core package
- [x] Properly type all factory function parameters and return values
- [x] Ensure two-phase contract enforcement is correctly implemented
- [x] Make all tests pass

- [ ] Implement proper contract type checking between different lattice
      components
- [ ] Add type-level validation for contract compatibility between model, state,
      actions, and view

- [ ] Implement the reactive runtime for state updates
- [ ] Create proper documentation with API examples
- [ ] Add integration tests for complete lattice usage examples
- [ ] Create additional utilities for contract validation and debugging
