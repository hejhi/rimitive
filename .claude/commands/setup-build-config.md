---
description: Interactive wizard to configure TypeScript, Vite, and test setup
tools: [Task, Write, Read]
workflow: create-package
---

Package name: $ARGUMENTS

Use the general-purpose agent to create an interactive wizard that:

1. **Gathers build configuration preferences** by asking the user:
   - Build output strategy:
     * Single bundled output (simpler, like @lattice/lattice)
     * Multiple entry points (more granular, like @lattice/signals)
   - TypeScript strictness level:
     * Standard (matches existing packages)
     * Extra strict (for new development)
   - Test setup requirements:
     * Basic unit tests only
     * Integration tests with other packages
     * Browser testing (for UI components)
   - Development mode preferences:
     * Watch mode for development
     * Source maps for debugging

2. **Creates TypeScript configuration**:
   - Generate tsconfig.json extending ../../tsconfig.json
   - Apply chosen strictness settings
   - Configure proper outDir and composite settings
   - Include appropriate file patterns

3. **Sets up Vite configuration**:
   - Create vite.config.ts based on output strategy choice
   - Configure entry points based on src/ structure analysis
   - Include dts plugin for TypeScript declarations
   - Set up terser minification for internal properties
   - Configure external dependencies properly

4. **Creates test configuration**:
   - Generate vitest.config.ts matching test requirements
   - Set up appropriate test environment (node/jsdom)
   - Configure test file patterns and globals
   - Create basic test file structure

5. **Completion instructions**:
   - After successful configuration, tell the user:
   - "Build configuration complete! Run `/workflow create-package setup-build-config next` to continue."

Requirements:
- Interactive prompts for build preferences
- Follow patterns from existing packages based on choices
- Ensure configuration compatibility with monorepo tooling
- Create appropriate starter files and examples
- Provide clear workflow navigation instructions