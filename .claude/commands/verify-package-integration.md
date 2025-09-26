---
description: Final verification and completion of package creation workflow
tools: [Bash, Task]
workflow: create-package
---

Package name: $ARGUMENTS

!pnpm install
!pnpm --filter @lattice/$ARGUMENTS typecheck
!pnpm --filter @lattice/$ARGUMENTS build
!pnpm --filter @lattice/$ARGUMENTS test

Use the general-purpose agent to:

1. **Run comprehensive verification**:
   - Execute all build commands and verify they pass
   - Check that pnpm workspace recognizes the new package
   - Ensure lerna can discover and build the package
   - Verify workspace dependencies resolve correctly

2. **Test integration with monorepo tooling**:
   - Run `pnpm build` from root to verify inclusion
   - Test `pnpm typecheck` runs successfully
   - Ensure `pnpm test` includes the new package
   - Verify lerna scripts work with the package

3. **Validate package functionality**:
   - Check that package exports are properly defined
   - Test importing from the package works
   - Verify tree-shaking is working correctly
   - Ensure no circular dependencies exist

4. **Provide completion summary**:
   - Show successful verification results
   - List all created files and their purposes
   - Provide next steps for development:
     * How to start development (`pnpm --filter @lattice/{package-name} dev`)
     * How to run tests (`pnpm --filter @lattice/{package-name} test`)
     * How to build (`pnpm --filter @lattice/{package-name} build`)
   - Suggest documentation improvements needed

5. **Workflow completion**:
   - Congratulate user on successful package creation
   - Tell the user: "Package creation workflow complete! 🎉"
   - "Run `/workflow create-package` to return to the workflow."
   - Provide package development guidance

Requirements:
- All verification commands must pass before completion
- Provide clear success/failure feedback
- Give practical next steps for package development
- Provide workflow navigation option to go back if needed