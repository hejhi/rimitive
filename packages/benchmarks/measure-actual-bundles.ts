#!/usr/bin/env node
import { gzipSync } from 'zlib';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '../..');

interface BundleInfo {
  name: string;
  path: string;
  rawSize: number;
  gzipSize: number;
  minified: boolean;
}

function measureFile(path: string): { raw: number; gzip: number } | null {
  if (!existsSync(path)) return null;
  
  const content = readFileSync(path);
  return {
    raw: content.length,
    gzip: gzipSync(content).length
  };
}

function formatSize(bytes: number): string {
  return (bytes / 1024).toFixed(2) + ' KB';
}

function checkIfMinified(path: string): boolean {
  const content = readFileSync(path, 'utf-8');
  // Simple heuristic: minified files have very long lines
  const lines = content.split('\n');
  const avgLineLength = content.length / lines.length;
  return avgLineLength > 500;
}

// Define packages to measure
const packages = [
  { name: '@lattice/core', path: 'packages/core/dist/index.js' },
  { name: '@lattice/runtime', path: 'packages/runtime/dist/index.js' },
  { name: '@lattice/adapter-redux', path: 'packages/adapter-redux/dist/index.js' },
  { name: '@lattice/adapter-zustand', path: 'packages/adapter-zustand/dist/index.js' },
  { name: '@lattice/adapter-store-react', path: 'packages/adapter-store-react/dist/index.js' },
  { name: '@lattice/adapter-svelte', path: 'packages/adapter-svelte/dist/index.js' },
  { name: '@lattice/store-react', path: 'packages/store-react/dist/index.js' },
];

console.log('📦 Measuring actual built bundles from dist directories...\n');

const results: BundleInfo[] = [];

for (const pkg of packages) {
  const fullPath = join(rootDir, pkg.path);
  const sizes = measureFile(fullPath);
  
  if (!sizes) {
    console.log(`❌ ${pkg.name}: Not found at ${pkg.path}`);
    continue;
  }
  
  const minified = checkIfMinified(fullPath);
  results.push({
    name: pkg.name,
    path: pkg.path,
    rawSize: sizes.raw,
    gzipSize: sizes.gzip,
    minified
  });
  
  console.log(`✅ ${pkg.name}: ${formatSize(sizes.gzip)} gzipped${minified ? ' (minified)' : ' (NOT minified)'}`);
}

console.log('\n' + '='.repeat(60));
console.log('📊 ACTUAL BUNDLE SIZE REPORT');
console.log('='.repeat(60) + '\n');

console.log('Package'.padEnd(35) + 'Gzipped'.padEnd(12) + 'Status');
console.log('-'.repeat(60));

for (const result of results) {
  console.log(
    result.name.padEnd(35) + 
    formatSize(result.gzipSize).padEnd(12) +
    (result.minified ? '✅ Optimized' : '⚠️  Not optimized')
  );
}

// Calculate totals
const coreSize = results.find(r => r.name === '@lattice/core')?.gzipSize || 0;
const runtimeSize = results.find(r => r.name === '@lattice/runtime')?.gzipSize || 0;
const storeReactAdapter = results.find(r => r.name === '@lattice/adapter-store-react')?.gzipSize || 0;

console.log('\n' + '='.repeat(60));
console.log('Complete Setup Sizes:');
console.log('-'.repeat(60));
console.log(`Core + Runtime + store-react: ${formatSize(coreSize + runtimeSize + storeReactAdapter)}`);

console.log('\n⚠️  Note: These are the ACTUAL sizes from your dist directories.');
console.log('Make sure all packages are built with production optimizations!');