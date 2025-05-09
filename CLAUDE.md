# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## References

These are your core principles and values:

- @docs/rules/01-core-principles.md
- @docs/rules/02-guiding-maxims.md
- @docs/rules/03-workflow.md
- @docs/rules/04-specs.md
- @docs/rules/05-coding-principles.md
- @docs/rules/06-commit-rules.md
- @docs/rules/07-ci-quality-gates.md
- @docs/rules/08-docs-and-naming.md
- @docs/rules/09-composition-first.md
- @docs/rules/10-toolchain-assumptions.md
- @README.md

The comprehensive, source-of-truth spec is located in `docs/spec.md`. It MUST
always remain up-to-date, and all implementation and tests must align to it.

## Build/Test/Lint Commands

- Build: `pnpm build` - Builds all packages (uses Lerna)
- Dev: `pnpm dev` - Runs development mode (uses Lerna). CAUTION: WILL HANG THE
  CHAT. The user always has it running, so not necessary for you to run.
- Lint: `pnpm lint` - Runs ESLint on TypeScript files
- Format: `pnpm format` - Runs Prettier
- Type check: `pnpm typecheck` - Runs TypeScript type checking (uses Lerna)
- Test: `pnpm test` - Runs all tests (uses Lerna)
- Run for specific package: `npx lerna run <task> --scope=<package-name>`
- Run for affected packages: `npx lerna run <task> --since=origin/main`
- Single test: `pnpm test -- path/to/test/file`
- Test files created for integration only; otherwise, uses vitest in-source
  test.
- Focus test: Use `.only` or `.skip` (e.g. `it.only()`, `describe.skip()`)

## Code Style Guidelines

- Follow STRICT TDD: write test, make it fail, make it pass, refactor
- TDD debugging: reproduce by making a test fail, make it pass, refactor
- Use functional over stateful code patterns
- React: Use functional components with hooks
- In-source testing with vitest
- TypeScript: Strict type checking
- Naming: kebab-case for packages, camelCase for hooks (with `use` prefix)
- Formatting: 2 spaces, 80 char line length, single quotes
- Use ESModules (import/export)

## Project Structure

- We use Lerna (which uses nx under the hood) and pnpm workspaces to manage our
  monorepo.
