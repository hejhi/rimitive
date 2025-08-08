# Agent Coding Handbook

This is the working playbook I follow to contribute code that fits Lattice’s patterns, style, and values.

## Core Principles
- Small, typed, ESM-first modules; avoid runtime side-effects. Prefer pure, composable functions and stable APIs.
- Safety and clarity over cleverness; performance-minded where hot paths matter.
- Minimal diffs that align with existing structure and scripts.

## Repository Conventions
- Monorepo via pnpm + Lerna (`packages/*`, `packages/examples/*`). Use `pnpm --filter <pkg> <script>` when scoping work.
- Packages are ESM with `exports` maps and `types` entries; internal deps use `workspace:*`.
- Mark tree-shakeable libraries with `"sideEffects": false`.

## Code Style
- TypeScript everywhere; explicit types and generics where useful. ESM only.
- Prettier: 2 spaces, single quotes, semicolons, trailing commas (es5), `arrowParens: always`.
- ESLint: `typescript-eslint`, React/Hooks for `*.tsx`, Storybook plugin where relevant.
- Naming: files kebab-case (`default-context.ts`); tests `*.test.ts`; symbols camelCase; types/interfaces PascalCase; constants UPPER_SNAKE_CASE; internal fields prefixed `_`.
- Comment discipline: use focused doc blocks for algorithms and decisions. Prefer tags seen in codebase, e.g. `ALGORITHM:`, `OPTIMIZATION:`, `PATTERN:` when explaining trade-offs or hot paths.

## Patterns Observed
- Reactive primitives favor immutability checks (`===`) and batch/queue coordination.
- Internal state uses underscored fields (e.g., `_value`, `_version`), plus string-literal `__type` markers for clarity.
- Performance-sensitive paths may prefer classes for V8 shape stability; otherwise prefer small functions/modules.
- Co-locate examples under `src/examples` when illustrating usage.

## Testing
- Framework: Vitest with globals enabled and Node environment.
- Location: co-located next to source as `name.test.ts` (e.g., `packages/signals/src/signal.test.ts`).
- Run all: `pnpm test`; scoped: `pnpm --filter @lattice/signals test`.
- Include edge cases and regression tests; keep tests deterministic and fast.

## Build & Tooling
- Build: `pnpm build` (workspace-wide) or `pnpm --filter <pkg> build` (per package). Vite + `vite-plugin-dts` for libs.
- Type safety: `pnpm typecheck`. Lint/format: `pnpm lint`, `pnpm format`.
- Clean: `pnpm clean` (per-package scripts use `rimraf`).

## Commits, Changesets, PRs
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). Concise, action-oriented subjects.
- Use `pnpm changeset` for user-visible changes; select packages and bump types per CONTRIBUTING.md.
- PRs must pass `pnpm test`, `pnpm typecheck`, `pnpm lint` and include descriptions, linked issues, and tests; add screenshots for UI/devtools changes.

## Performance & Benchmarks
- For performance-sensitive changes in reactive paths, validate using:
  - `pnpm bench` (local), `pnpm bench:compare` (compare baselines), `pnpm bench:ci` (CI mode).
- Prefer micro-optimizations only with evidence; document with `OPTIMIZATION:` comments.

## Package Scaffolding Checklist
- `package.json`: ESM `type`, `exports`, `types`, `files`, `sideEffects: false`, scripts (`build`, `dev`, `typecheck`, `lint`, `test`, `check`).
- `vitest.config.ts`: Node env, include source, exclude `dist` and `node_modules`.
- Source layout: `src/` with co-located tests; maintain subpath exports when applicable.

## Do/Don’t
- Do keep modules free of top-level side effects; initialize in entrypoints.
- Do maintain public API stability and accurate types.
- Don’t introduce new toolchains when existing ones suffice (stick to pnpm/Lerna/Vite/Vitest/ESLint/Prettier).
- Don’t bypass ESLint or Prettier; format and lint before PRs.
