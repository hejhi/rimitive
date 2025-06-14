#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('📦 Running bundle size analysis...\n');

try {
  // Run the bundle size benchmark
  execSync('pnpm vitest run src/bundle-size.bench.ts', {
    stdio: 'inherit',
    cwd: __dirname
  });

  // Display the report
  const reportPath = join(__dirname, 'bundle-size-report.md');
  if (existsSync(reportPath)) {
    const report = readFileSync(reportPath, 'utf-8');
    console.log('\n' + '='.repeat(60));
    console.log(report);
  }
} catch (error) {
  console.error('Failed to run bundle size analysis:', error);
  process.exit(1);
}