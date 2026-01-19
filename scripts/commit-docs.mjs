#!/usr/bin/env node
// Regenerates llms docs and benchmarks, commits if changed.
// Used by prechangeset script.

import { execSync } from 'node:child_process';

function run(cmd, options = {}) {
  const result = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', ...options });
  return result ? result.trim() : '';
}

function hasChanges(files) {
  try {
    run(`git diff --quiet -- ${files.join(' ')}`);
    return false;
  } catch {
    return true;
  }
}

function hasStagedChanges(files) {
  try {
    run(`git diff --staged --quiet -- ${files.join(' ')}`);
    return false;
  } catch {
    return true;
  }
}

const LLMS_FILES = ['llms.txt', 'llms-full.txt'];
const BENCH_FILES = ['packages/docs/src/data/benchmarks.json'];
const isCI = process.env.CI === 'true';

// Regenerate llms docs
console.log('Regenerating llms docs...');
execSync('node scripts/generate-llms.mjs', { stdio: 'inherit' });

// Regenerate benchmarks (skip in CI - results aren't meaningful on shared runners)
if (!isCI) {
  console.log('\nRegenerating benchmarks...');
  execSync('pnpm bench:docs', { stdio: 'inherit' });
} else {
  console.log('\nSkipping benchmarks in CI environment');
}

// Check and commit changes
const filesToCheck = isCI ? LLMS_FILES : [...LLMS_FILES, ...BENCH_FILES];

if (hasChanges(filesToCheck) || hasStagedChanges(filesToCheck)) {
  console.log('\nChanges detected, committing...');
  run(`git add ${filesToCheck.join(' ')}`);

  if (hasStagedChanges(filesToCheck)) {
    const msg = isCI ? 'chore: regenerate llms docs' : 'chore: regenerate docs (llms + benchmarks)';
    run(`git commit -m "${msg}"`);
    console.log('Committed docs update.');
  } else {
    console.log('Files already staged, skipping commit.');
  }
} else {
  console.log('\nNo changes to docs.');
}
