/*
 * Minimal memory measurement helpers for benchmarks.
 *
 * Note: Logging inside a bench adds tiny overhead to the first iteration.
 * We guard to log at most once per bench name to limit noise.
 */

export function formatBytes(bytes: number): string {
  const abs = Math.abs(bytes);
  if (abs >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (abs >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (abs >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

const logged = new Set<string>();

export function forceGC() {
  try {
    if (typeof globalThis.gc === 'function') {
      // Run GC a few times to stabilize heap
      globalThis.gc();
      globalThis.gc();
    }
  } catch {}
}

export function measureMemoryOnce<T>(name: string, work: () => T): T {
  // Only log on the first invocation per bench name to avoid spam
  const shouldLog = !logged.has(name);
  let setup = 0;
  if (shouldLog) {
    forceGC();
    setup = process.memoryUsage().heapUsed;
  }

  const result = work();

  if (shouldLog) {
    forceGC();
    const total = process.memoryUsage().heapUsed;
    const delta = total - setup;
    // These strings are parsed by scripts/run-chunked-benchmarks.js
    // Pattern: "<name> setup memory: <value unit>" etc.
    // eslint-disable-next-line no-console
    console.log(`${name} setup memory: ${formatBytes(setup)}`);
    // eslint-disable-next-line no-console
    console.log(`${name} memory delta: ${formatBytes(delta)}`);
    // eslint-disable-next-line no-console
    console.log(`${name} total memory: ${formatBytes(total)}`);
    logged.add(name);
  }

  return result;
}

