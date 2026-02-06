#!/usr/bin/env node
// Regenerates llms.txt, commits if changed.
// Used by husky pre-push hook and prechangeset script.

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

const FILES = ['llms.txt'];

console.log('Regenerating llms docs...');
execSync('node scripts/generate-llms.mjs', { stdio: 'inherit' });

if (hasChanges(FILES) || hasStagedChanges(FILES)) {
  console.log('Changes detected, committing...');
  run(`git add ${FILES.join(' ')}`);

  // Only commit if there are staged changes (might already be staged)
  if (hasStagedChanges(FILES)) {
    run(`git commit -m "chore: regenerate llms docs"`);
    console.log('Committed llms docs update.');
  } else {
    console.log('Files already staged, skipping commit.');
  }
} else {
  console.log('No changes to llms docs.');
}
