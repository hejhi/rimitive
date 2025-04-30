# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Test/Lint Commands
- Build: `pnpm build` - Builds all packages (uses Lerna)
- Dev: `pnpm dev` - Runs development mode (uses Lerna)
- Lint: `pnpm lint` - Runs ESLint on TypeScript files
- Format: `pnpm format` - Runs Prettier
- Type check: `pnpm typecheck` - Runs TypeScript type checking (uses Lerna)
- Test: `pnpm test` - Runs all tests (uses Lerna)
- Run for specific package: `npx lerna run <task> --scope=<package-name>`
- Run for affected packages: `npx lerna run <task> --since=origin/main`
- Single test: `vitest run --environment jsdom path/to/test/file`
- Focus test: Use `.only` or `.skip` (e.g. `it.only()`, `describe.skip()`)

## Code Style Guidelines
- Follow TDD: write test, make it fail, make it pass, refactor
- Use functional over stateful code patterns
- React: Use functional components with hooks
- TypeScript: Strict type checking
- Naming: kebab-case for packages, camelCase for hooks (with `use` prefix)
- Formatting: 2 spaces, 80 char line length, single quotes
- Use ESModules (import/export)

## Commit Conventions
- Format: `<type>(<scope>): <description>`
- Types: feat, fix, docs, style, refactor, perf, test, chore
- Use imperative mood in descriptions

## Project Structure
- We use Lerna (which uses nx under the hood) and pnpm workspaces to manage our monorepo.