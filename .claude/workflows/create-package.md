---
name: "Lattice Monorepo Package Creation"
description: "Complete workflow for creating a new package in the Lattice monorepo with proper setup and configuration"
stages:
  - name: "Package Scaffolding"
    command: "/scaffold-package"
    description: "Create initial package structure, such as package.json and basic files"

  - name: "Build Configuration"
    command: "/setup-build-config"
    description: "Set up package configuration files, such as configs, dotfiles, etc"
---

# Lattice Monorepo Package Creation Workflow

This workflow guides you through creating a new package in the Lattice monorepo following established patterns and conventions.

## Overview

The process involves 3 main stages that ensure proper monorepo integration:

1. **Package Scaffolding** - Create basic package structure and metadata
2. **Build Configuration** - Set up language or framework config files, like types, testing, or tooling
3. **Integration Verification** - Verify everything works with monorepo tooling

## Key Features

- **Pattern Consistency**: Follows established conventions from @lattice/signals, @lattice/lattice, @lattice/react
- **Proper Exports**: Sets up modular exports with tree-shaking support
- **TypeScript Ready**: Full TypeScript configuration with strict settings
- **Build Integration**: Vite configuration with proper entry points and minification
- **Test Framework**: Vitest setup matching existing packages
- **Workspace Ready**: Proper pnpm workspace and lerna integration

## Package Naming

Use the format: `@lattice/package-name`

Examples:
- `@lattice/ui-components`
- `@lattice/data-store`
- `@lattice/validation`

## Key Principles

- **Follow existing patterns** - Study @lattice/signals, @lattice/lattice, @lattice/react
- **Maintain tree-shaking** - Use proper exports and avoid side effects
- **Factory pattern** - Use composable factories for extensibility where applicable
- **TypeScript first** - Proper types and strict configuration
- **Test coverage** - At least basic tests for main functionality

## Expected Timeline

- Scaffolding: 5 minutes
- Build configuration: 5 minutes
- Integration verification: 3 minutes
- Total: ~10-15 minutes