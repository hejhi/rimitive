/**
 * @fileoverview Vitest setup for enhanced benchmark performance tracking
 */

// Enable memory tracking if running in Node.js with --expose-gc flag
if (typeof globalThis.gc === 'undefined' && typeof process !== 'undefined') {
  // Warn user that memory tracking is limited without --expose-gc
  console.warn(
    '\n⚠️  For accurate memory measurements, run benchmarks with: node --expose-gc\n'
  );
}

// Performance tracking configuration
console.log('🔧 Benchmark performance tracking enabled');
if (typeof globalThis.gc === 'function') {
  console.log('✅ Memory tracking: Full (--expose-gc detected)');
} else {
  console.log(
    '⚠️  Memory tracking: Limited (run with --expose-gc for full tracking)'
  );
}
