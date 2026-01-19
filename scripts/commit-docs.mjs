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

// Regenerate llms docs
console.log('Regenerating llms docs...');
execSync('node scripts/generate-llms.mjs', { stdio: 'inherit' });

// Regenerate benchmarks
console.log('\nRegenerating benchmarks...');
execSync('pnpm bench:docs', { stdio: 'inherit' });

// Check and commit llms changes
const allFiles = [...LLMS_FILES, ...BENCH_FILES];

if (hasChanges(allFiles) || hasStagedChanges(allFiles)) {
  console.log('\nChanges detected, committing...');
  run(`git add ${allFiles.join(' ')}`);

  if (hasStagedChanges(allFiles)) {
    run(`git commit -m "chore: regenerate docs (llms + benchmarks)"`);
    console.log('Committed docs update.');
  } else {
    console.log('Files already staged, skipping commit.');
  }
} else {
  console.log('\nNo changes to docs.');
}
