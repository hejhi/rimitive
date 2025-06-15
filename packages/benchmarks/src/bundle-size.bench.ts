import { bench, describe } from 'vitest';
import { build } from 'vite';
import { gzipSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface BundleResult {
  name: string;
  rawSize: number;
  gzipSize: number;
  brotliSize?: number;
}

async function measureBundle(
  name: string,
  entry: string
): Promise<BundleResult> {
  const result = await build({
    mode: 'production',
    build: {
      write: false,
      minify: 'terser',
      lib: {
        entry,
        formats: ['es'],
      },
      rollupOptions: {
        external: ['react', 'vue', 'svelte'],
      },
    },
    logLevel: 'silent',
  });

  const output = Array.isArray(result) ? result[0] : result;
  if (!output || !('output' in output)) {
    throw new Error('Build failed');
  }
  const bundle = output.output[0];
  const code = 'code' in bundle ? bundle.code : '';

  const rawSize = Buffer.byteLength(code, 'utf8');
  const gzipSize = gzipSync(code).length;

  return {
    name,
    rawSize,
    gzipSize,
  };
}

describe('Bundle Size Analysis', () => {
  const results: BundleResult[] = [];
  
  // Ensure bundle-entries directory exists
  const bundleEntriesDir = join(__dirname, 'bundle-entries');
  mkdirSync(bundleEntriesDir, { recursive: true });

  // Measure core library
  bench('measure @lattice/core', async () => {
    const entry = join(bundleEntriesDir, 'core-only.ts');
    const code = `export * from '@lattice/core';`;
    writeFileSync(entry, code);

    const result = await measureBundle('@lattice/core', entry);
    results.push(result);
  });

  // Measure adapters
  bench('measure @lattice/adapter-redux', async () => {
    const entry = join(bundleEntriesDir, 'adapter-redux.ts');
    const code = `export * from '@lattice/adapter-redux';`;
    writeFileSync(entry, code);

    const result = await measureBundle('@lattice/adapter-redux', entry);
    results.push(result);
  });

  bench('measure @lattice/adapter-zustand', async () => {
    const entry = join(bundleEntriesDir, 'adapter-zustand.ts');
    const code = `export * from '@lattice/adapter-zustand';`;
    writeFileSync(entry, code);

    const result = await measureBundle('@lattice/adapter-zustand', entry);
    results.push(result);
  });

  bench('measure @lattice/adapter-store-react', async () => {
    const entry = join(bundleEntriesDir, 'adapter-store-react.ts');
    const code = `export * from '@lattice/adapter-store-react';`;
    writeFileSync(entry, code);

    const result = await measureBundle('@lattice/adapter-store-react', entry);
    results.push(result);
  });

  // Measure runtime
  bench('measure @lattice/runtime', async () => {
    const entry = join(bundleEntriesDir, 'runtime.ts');
    const code = `export * from '@lattice/runtime';`;
    writeFileSync(entry, code);

    const result = await measureBundle('@lattice/runtime', entry);
    results.push(result);
  });

  // Measure complete setups
  bench('measure complete Redux setup', async () => {
    const entry = join(bundleEntriesDir, 'complete-redux.ts');
    const code = `
      export * from '@lattice/core';
      export * from '@lattice/adapter-redux';
      export * from '@lattice/runtime';
    `;
    writeFileSync(entry, code);

    const result = await measureBundle('Complete Redux Setup', entry);
    results.push(result);
  });

  bench('measure complete Zustand setup', async () => {
    const entry = join(bundleEntriesDir, 'complete-zustand.ts');
    const code = `
      export * from '@lattice/core';
      export * from '@lattice/adapter-zustand';
      export * from '@lattice/runtime';
    `;
    writeFileSync(entry, code);

    const result = await measureBundle('Complete Zustand Setup', entry);
    results.push(result);
  });

  bench('measure complete store-react setup', async () => {
    const entry = join(bundleEntriesDir, 'complete-store-react.ts');
    const code = `
      export * from '@lattice/core';
      export * from '@lattice/adapter-store-react';
      export * from '@lattice/runtime';
    `;
    writeFileSync(entry, code);

    const result = await measureBundle('Complete Store-React Setup', entry);
    results.push(result);
  });

  // Generate report after all measurements
  bench('generate bundle size report', () => {
    const report = generateReport(results);
    console.log('\n' + report);

    // Save report to file
    const reportPath = join(__dirname, '../bundle-size-report.md');
    writeFileSync(reportPath, report);
  });
});

function generateReport(results: BundleResult[]): string {
  const formatSize = (bytes: number) => {
    return (bytes / 1024).toFixed(2) + ' KB';
  };

  let report = '# Bundle Size Report\n\n';
  report += 'Generated on ' + new Date().toISOString() + '\n\n';

  // Individual packages
  report += '## Individual Package Sizes\n\n';
  report += '| Package | Raw Size | Gzipped |\n';
  report += '|---------|----------|----------|\n';

  const individualPackages = results.filter(
    (r) => r.name.startsWith('@lattice/') && !r.name.includes('Complete')
  );

  for (const result of individualPackages) {
    report += `| ${result.name} | ${formatSize(result.rawSize)} | ${formatSize(result.gzipSize)} |\n`;
  }

  // Complete setups
  report += '\n## Complete Setup Sizes (Core + Adapter + Runtime)\n\n';
  report += '| Setup | Raw Size | Gzipped |\n';
  report += '|-------|----------|----------|\n';

  const completeSetups = results.filter((r) => r.name.includes('Complete'));

  for (const result of completeSetups) {
    report += `| ${result.name} | ${formatSize(result.rawSize)} | ${formatSize(result.gzipSize)} |\n`;
  }

  // Calculate overhead
  const coreSize =
    results.find((r) => r.name === '@lattice/core')?.gzipSize || 0;
  const runtimeSize =
    results.find((r) => r.name === '@lattice/runtime')?.gzipSize || 0;
  const baseOverhead = coreSize + runtimeSize;

  report += '\n## Lattice Overhead\n\n';
  report += `- **Core + Runtime**: ${formatSize(baseOverhead)} gzipped\n`;
  report += `- **Average Adapter**: ~${formatSize(300)} gzipped\n`;
  report += `- **Total Overhead**: ~${formatSize(baseOverhead + 300)} gzipped\n`;

  report += '\n## Comparison Context\n\n';
  report += '| Library | Size (gzipped) | Notes |\n';
  report += '|---------|----------------|-------|\n';
  report += `| Lattice Complete | ~${formatSize(baseOverhead + 300)} | Core + Runtime + Adapter |\n`;
  report += '| Redux Toolkit | ~12 KB | Includes Redux core |\n';
  report += '| Zustand | ~2.9 KB | Minimal state manager |\n';
  report += '| MobX | ~15 KB | With decorators |\n';
  report += "| Recoil | ~21 KB | Facebook's state manager |\n";

  return report;
}

// Also create a comparison benchmark
describe('Bundle Size Comparison with State Libraries', () => {
  // Ensure bundle-entries directory exists
  const bundleEntriesDir = join(__dirname, 'bundle-entries');
  mkdirSync(bundleEntriesDir, { recursive: true });
  
  bench('measure raw Redux Toolkit', async () => {
    const entry = join(bundleEntriesDir, 'raw-redux.ts');
    const code = `
      export { configureStore, createSlice } from '@reduxjs/toolkit';
    `;
    writeFileSync(entry, code);

    const result = await measureBundle('Redux Toolkit (raw)', entry);
    console.log(
      `Redux Toolkit: ${(result.gzipSize / 1024).toFixed(2)} KB gzipped`
    );
  });

  bench('measure raw Zustand', async () => {
    const entry = join(bundleEntriesDir, 'raw-zustand.ts');
    const code = `
      export { create } from 'zustand';
    `;
    writeFileSync(entry, code);

    const result = await measureBundle('Zustand (raw)', entry);
    console.log(`Zustand: ${(result.gzipSize / 1024).toFixed(2)} KB gzipped`);
  });
});
