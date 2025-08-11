#!/usr/bin/env tsx
/**
 * Runner script for all mitata benchmarks
 */

import { glob } from 'glob';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runBenchmarks() {
  // Find all benchmark files
  const benchFiles = await glob('src/suites/lattice/*.bench.ts', {
    cwd: __dirname,
    absolute: true
  });

  console.log(`Found ${benchFiles.length} benchmark files\n`);

  for (const file of benchFiles) {
    const fileName = file.split('/').pop();
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Running: ${fileName}`);
    console.log('='.repeat(80) + '\n');

    await new Promise<void>((resolve, reject) => {
      const child = spawn('tsx', ['--expose-gc', file], {
        stdio: 'inherit',
        shell: true
      });

      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Benchmark ${fileName} failed with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('All benchmarks completed!');
  console.log('='.repeat(80));
}

runBenchmarks().catch(error => {
  console.error('Error running benchmarks:', error);
  process.exit(1);
});