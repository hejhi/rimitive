# Rimitive - js-framework-benchmark Implementation

This directory contains the Rimitive implementation for the [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark).

## Prerequisites

- **Node.js** >= v20.9.0 (tested with v24.8.0)
- **npm** >= 10.1.0
- **pnpm** (for Rimitive workspace dependencies)

Verify your setup:

```bash
node --version  # Should be >= v20.9.0
npm --version   # Should be >= 10.1.0
pnpm --version
```

## Complete Setup Guide

### 1. Clone Both Repositories

Clone the Rimitive repo (if you haven't already):

```bash
cd ~/repos  # or wherever you keep your projects
git clone https://github.com/rimitive.git
cd rimitive
pnpm install
```

Clone the js-framework-benchmark repo:

```bash
cd ~/repos  # same parent directory recommended
git clone https://github.com/krausest/js-framework-benchmark.git
cd js-framework-benchmark
```

### 2. Set Up js-framework-benchmark

Install the benchmark infrastructure:

```bash
# From js-framework-benchmark root
npm ci
npm run install-local
```

This installs:

- Root dependencies
- Benchmark driver (webdriver-ts)
- Results viewer (webdriver-ts-results)
- Web server

### 3. Create the Symlink

Link your Rimitive implementation into the benchmark directory:

```bash
# From js-framework-benchmark root
# Adjust paths if your repos are in different locations
ln -s ~/repos/rimitive/packages/benchmarks/frameworks/rimitive-keyed frameworks/keyed/rimitive
```

Verify the symlink works:

```bash
ls -la frameworks/keyed/rimitive  # Should show the directory contents
```

### 4. Build Rimitive Implementation

Since Rimitive uses pnpm workspaces, build from the Rimitive repo:

```bash
# From the rimitive repo root
cd ~/repos/rimitive
pnpm install  # if not already done
pnpm run build  # or your build command
```

Or build just the benchmark package:

```bash
cd ~/repos/rimitive/packages/benchmarks/frameworks/rimitive-keyed
pnpm run build-prod
```

### 5. Start the Benchmark Server

```bash
# From js-framework-benchmark root
cd ~/repos/js-framework-benchmark
npm start
```

The server will run on http://localhost:8080. Keep it running in this terminal.

### 6. Verify in Browser

Open http://localhost:8080/frameworks/keyed/rimitive/ in your browser to manually test the implementation.

## Running Automated Benchmarks

### Run benchmarks for Rimitive only

Open a **new terminal** (keep the server running) and run:

```bash
cd ~/repos/js-framework-benchmark
npm run bench -- --framework keyed/rimitive
```

This will:

- Open Chrome automatically
- Run all benchmark operations multiple times
- Take several minutes to complete
- Save results to `webdriver-ts/results/`

### Run specific benchmarks

```bash
# Run only create and update benchmarks
npm run bench -- --benchmark 01_ 02_ --framework keyed/rimitive

# Run multiple frameworks for comparison
npm run bench -- --framework keyed/rimitive keyed/vanillajs
```

### View Results

After benchmarks complete:

```bash
npm run results
```

Then open http://localhost:8080/webdriver-ts-results/dist/index.html in your browser.

## Development Workflow

When making changes to the Rimitive implementation:

1. **Edit code** in `~/repos/rimitive/packages/benchmarks/frameworks/rimitive-keyed/src/`

2. **Rebuild** from the Rimitive repo:

   ```bash
   cd ~/repos/rimitive/packages/benchmarks/frameworks/rimitive-keyed
   pnpm run build-prod
   # Or use watch mode: pnpm run dev
   ```

3. **Test manually** at http://localhost:8080/frameworks/keyed/rimitive/

   - Click buttons to verify functionality
   - Check browser console for errors

4. **Run benchmarks** to measure performance:

   ```bash
   cd ~/repos/js-framework-benchmark
   npm run bench -- --framework keyed/rimitive
   ```

5. **Compare results** at http://localhost:8080/webdriver-ts-results/dist/index.html

## Troubleshooting

### Broken Symlink

If you see "broken symbolic link" errors:

```bash
cd ~/repos/js-framework-benchmark
rm frameworks/keyed/rimitive
ln -s ~/repos/rimitive/packages/benchmarks/frameworks/rimitive-keyed frameworks/keyed/rimitive
```

### Build Errors

Since Rimitive uses workspace dependencies (`workspace:*`), **don't run `npm ci`** in the rimitive directory. Instead, build from the Rimitive repo root:

```bash
cd ~/repos/rimitive
pnpm install
pnpm run build
```

### Server Port Already in Use

If port 8080 is already taken:

```bash
# Kill the existing server
pkill -f "npm start"
# Or find and kill the process using port 8080
lsof -ti:8080 | xargs kill
```

## Implementation Notes

- Uses Rimitive's fine-grained reactivity (signals + effects)
- Elements created with lifecycle callbacks that run immediately
- No MutationObserver overhead
- Explicit cleanup via scope disposal when elements are removed by reconciler
