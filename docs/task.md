- Implement contract enforcement in the createModel factory:
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

- Implement two-phase contract enforcement for createView, createState, and
  createActions, matching the createModel pattern and spec. Ensure tests pass
  for each factory.
  - TDD Guidance: The existing tests in
    packages/core/src/tests/composition-phase.test.ts are sufficient for strict
    TDD. For each factory, follow the Red → Green loop: implement contract
    enforcement until the corresponding test passes. Only add new tests if new
    edge cases or behaviors are discovered during implementation.

- Replace all `any` types in the core factories and enforcement utility with
  strong, spec-compliant TypeScript types. Ensure the API surface is fully typed
  and illegal states are unrepresentable. Use TDD/type tests as you go.

- Implement strong type-level and runtime contract enforcement for the remaining
  Lattice core factories: createState, createActions, and createView.
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

- Implement contract enforcement and type-safe composition for createLattice:
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
