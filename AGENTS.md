Treat this file, AGENT_HANDBOOK.md, and LEAD_ENGINEER_CHARTER.md as binding system instructions for this repository. Before doing any work, read and follow them. Reload them once per session or when they change.

Referenced guidance:
- Working playbook: [AGENT_HANDBOOK.md](./AGENT_HANDBOOK.md)
- Lead engineer standards: [LEAD_ENGINEER_CHARTER.md](./LEAD_ENGINEER_CHARTER.md)

# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by pnpm + Lerna; workspaces under `packages/*` and `packages/examples/*`.
- Core libraries: `packages/signals` (reactive primitives) and `packages/lattice` (composition layer).
- Framework bindings and tooling: `packages/react`, `packages/preact-signals`, `packages/devtools-extension` (WXT-based), `packages/benchmarks`, `packages/docs`, and `packages/examples`.
- Tests are colocated with source files as `*.test.ts` (for example: `packages/signals/src/signal.test.ts`).

## Build, Test, and Development Commands
- `pnpm install`: Install dependencies (Node >= 18 required).
- `pnpm build`: Build all packages via Lerna/Vite.
- `pnpm dev`: Watch/build packages in parallel for local development.
- `pnpm test`: Run Vitest suites across workspace.
- `pnpm typecheck`: Type-check all packages with `tsc`.
- `pnpm lint` / `pnpm format`: Lint with ESLint; format with Prettier.
- `pnpm clean`: Remove build output per package.
- Filter by package: `pnpm --filter @lattice/signals test` (works with any script).
- Releases: `pnpm release` (build + Changesets publish, used in CI).

## Coding Style & Naming Conventions
- Language: TypeScript (ESM). Indent 2 spaces, single quotes, semicolons, trailing commas (es5), `arrowParens: always` (see `.prettierrc`).
- Linting: ESLint with `typescript-eslint`, React/Hooks, and Storybook configs (`eslint.config.js`).
- Files: lowercase names; prefer kebab-case for multiword files (e.g., `computed-peak.test.ts`).
- Symbols: functions/variables camelCase; types/interfaces PascalCase; constants UPPER_SNAKE_CASE.

## Testing Guidelines
- Framework: Vitest with per-package configs (see `packages/*/vitest.config.ts`).
- Location: co-locate tests next to code as `name.test.ts`.
- Run: `pnpm test` (all) or `pnpm --filter <pkg> test` (scoped).
- Aim for fast, deterministic unit tests covering core behaviors and edge cases. Use Node test env (`environment: 'node'`).

## Commit & Pull Request Guidelines
- Commits: use Conventional Commits (e.g., `feat: add async computed`, `fix: handle teardown race`).
- Changesets: run `pnpm changeset` for user-visible changes; follow CONTRIBUTING for bump types.
- PRs: include clear description, linked issues, relevant tests, and screenshots for UI/devtools changes.
- CI checks must pass: `pnpm test`, `pnpm typecheck`, `pnpm lint` (or `pnpm check`).

## Security & Configuration Tips
- Use pnpm exclusively; do not commit `dist/` or `node_modules/`.
- Devtools package has WXT-specific globals; see ESLint ignores in `eslint.config.js`.
