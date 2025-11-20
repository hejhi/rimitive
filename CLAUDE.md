# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Core Development Scripts

```bash
# Build all packages
pnpm build

# Run all tests
pnpm test

# Type checking
pnpm typecheck                    # All packages

# Linting
pnpm lint                         # All packages

# Complete check (typecheck + test + lint)
pnpm check                        # All packages

# pnpm workspace matchers
# Run tests for specific package
pnpm --filter @lattice/signals test
pnpm --filter @lattice/lattice test

# Run specific test file
pnpm --filter @lattice/signals test src/computed.test.ts

# Run test matching pattern
pnpm --filter @lattice/signals test -- "should handle deep dependency"
```

### Benchmarking

```bash
# Run all benchmarks
pnpm bench

# Run specific benchmark
pnpm bench diamond-simple

# Run benchmarks with timeout
timeout 60 pnpm bench chain-deep
```

## Architecture Overview

### Package Structure

The codebase is organized as a lerna monorepo using pnpm workspaces. The core packages are located in @packages/. Reference packages (such as the source code for `alien-signals` and `preact-signas`) are located in `/reference-packages`.

### Testing Strategy

Tests are co-located with source files:

- Unit tests: `*.test.ts` files next to implementation
- Integration tests in `api.test.ts`
- Memory leak tests in `detached-memory.test.ts`
- Performance regression prevention via benchmarks

## Git Workflow

Follow conventional commits:

- `fix:` - Bug fixes
- `feat:` - New features
- `docs:` - Documentation
- `chore:` - Maintenance
- `test:` - Test changes

Create changesets for releases:

```bash
pnpm changeset
```

## Workflows

**What workflows are**: Multi-stage task automation sequences in `.claude/workflows/*.md` that orchestrate complex operations through slash commands. Each workflow defines stages with specific commands, providing progress tracking and guided execution.

**Creating a workflow**: Place a markdown file in `.claude/workflows/` with YAML frontmatter defining stages. Each stage specifies a `name`, `command` (slash command to run), and `description`. The workflow runs via `/workflow [workflow-name]` and tracks completion by examining typical outputs from each command.

Example structure:

```yaml
---
name: 'My Workflow'
description: 'What this workflow does'
stages:
  - name: 'First Stage'
    command: '/some-command'
    description: 'What this stage accomplishes'
---
```

## Communication Style and Principles

When working in this codebase, adopt the following communication style and principles:

- **Direct and honest**: Be straightforward without unnecessary embellishment. If something is wrong, say so plainly.
- **Pragmatic**: Focus on practical solutions over theoretical perfection. What works is more important than what's elegant.
- **Jantelov mindset**: Simple, working solutions are valued.
- **Concise**: Keep explanations brief and to the point.
- **Trust-based**: Assume good intentions and competence. Don't over-explain obvious things.

An important note on the **direct and honest** principle:

**NEVER REVERT, RESTORE, OR ABANDON DURING AN IMPLEMENTATION**.

When you inevitably run into roadblocks during implementation, and you're considering reverting, restoring, or changing strategies, do one or more of the below:

- **ANALYZE AND THINK DEEPLY**: if you don't explicitly understand the fundamental problem underlying the roadblock, the top priority is to figure it out and synthesize it into detailed, actionable knowledge
- **THINK HARDER**: re-assess the roadblock with this added knowledge and strategize how you can iterate through it

When all else fails, and you determine that either:

- the approach is fundamentally flawed
- there's too much ambiguity to continue iterating
- you can't get to the root of the problem

...then **STOP** and consult the user.

**You should NEVER make the decision to go backwards or change direction unless explicitly instructed to by the user. Doing so comprimises the users trust in your autonomy and ability to follow instructions**.

Remember: implementation "roadblocks" are opportunities to dig deeper and uncover valuable, actionable knowledge **AS PART OF** an iteration, but they are **NEVER** an excuse to abandon it.
