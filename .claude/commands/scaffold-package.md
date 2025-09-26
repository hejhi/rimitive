---
description: Interactive wizard to create initial package structure and configuration
tools: [Task, Bash, Write, MultiEdit]
workflow: create-package
---

Package name: $ARGUMENTS

Use the general-purpose agent to create an interactive wizard that:

1. **Gathers package information** by asking the user:
   - Package name (if not provided in $ARGUMENTS)
   - Package type:
     * Core library (like @lattice/signals)
     * Framework integration (like @lattice/react)
     * Development tooling (like @lattice/benchmarks)
     * Example/demo package
   - Brief description of the package purpose
   - Which existing @lattice packages it will depend on
   - Main export strategy (single entry point vs multiple modules)

2. **Analyzes existing packages** to understand patterns:
   - Study packages/signals/package.json, packages/lattice/package.json, packages/react/package.json
   - Identify appropriate dependency patterns based on package type
   - Determine export configuration strategy

3. **Creates package structure**:
   - packages/{package-name}/ directory
   - packages/{package-name}/src/ with appropriate entry files
   - packages/{package-name}/README.md with description
   - packages/{package-name}/package.json following established patterns

4. **Completion instructions**:
   - After successful creation, tell the user:
   - "Package scaffolding complete! Run `/workflow create-package scaffold-package next` to continue."

Requirements:
- Interactive prompts for all configuration decisions
- Validate package name doesn't conflict with existing packages
- Follow exact patterns from existing packages
- Use workspace:* for internal @lattice dependencies
- Set up proper export maps for tree-shaking
- Provide clear next step instructions using workflow navigation