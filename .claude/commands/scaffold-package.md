---
description: Interactive wizard to create initial package structure
argument-hint: [package-name] [in-workflow]
---

Package name: $1
Currently in workflow: $2

Behave as an interactive wizard to help the user scaffold a barebones package:

1. **Gather package information** by asking the user:
   - Package name (if not provided)?
   - Package type? For example:
     * Core library
     * Framework integration
     * Development tooling
     * Example/demo package
   - Brief description of the package purpose?
   - Which existing packages to model it on?
   - Any internal or external dependencies?

2. **Analyze existing packages** to understand existing patterns:
   - Identify appropriate dependency patterns based on package type
   - Determine export configuration strategy
   - Understand if you need to link to it at the root or in root-level configuration files

3. **Create package structure**: create the barebones package structure idiomatically to the rest of the codebase.

4. **Completion instructions**:
   - When completed, if running as part of a workflow ($2), tell the user: "Complete! Run `/workflow $2 forward` to continue."

Requirements:
- Validate package name doesn't conflict with existing packages
- Ensure compatibility with monorepo tooling (workspace or package managers, root-level config files that need updating, etc)
- Follow exact patterns from existing packages
