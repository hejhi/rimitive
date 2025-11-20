---
description: Interactive wizard to configure a monorepo package
argument-hint: [package-name] [in-workflow]
---

Package name: $1
Currently in workflow: $2

Behave as an interactive wizard to help the user configure the $1 package (if no package name is provided, assume it's the package they have an open file in, or ask the user first):

1. **Gather build configuration preferences** by asking the user for a description of the stack they'd like to use for the package (ie, vite? react with typescript? rust? shadcn?)

2. **Analyze existing/other packages** to understand what's already present and how other similar packages are configured:

   - Identify appropriate dependency patterns based on package type
   - See if other packages extend configurations, like tsconfig etc

3. **Completion instructions**:
   - When completed, if running as part of a workflow ($2), tell the user: "Complete! Run `/workflow $2 forward` to continue."

Requirements:

- Follow patterns from existing packages based on choices
- Ensure configuration compatibility with monorepo tooling
- Ask the user before you run any npx/pnpx/etc setup/create commands
- Provide clear workflow navigation instructions
