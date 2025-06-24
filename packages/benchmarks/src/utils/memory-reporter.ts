/**
 * @fileoverview Enhanced benchmark reporter with memory tracking
 */

interface MemoryMeasurement {
  beforeHeap: number;
  afterHeap: number;
  delta: number;
  timestamp: number;
}

interface BenchmarkMemoryData {
  setup: MemoryMeasurement | null;
  teardown: MemoryMeasurement | null;
  executions: MemoryMeasurement[];
}

// Global memory tracking storage
const memoryData = new Map<string, BenchmarkMemoryData>();

export function initMemoryTracking(benchmarkName: string) {
  if (!memoryData.has(benchmarkName)) {
    memoryData.set(benchmarkName, {
      setup: null,
      teardown: null,
      executions: []
    });
  }
}

export function measureMemory(operation: 'setup' | 'teardown' | 'execution', benchmarkName: string, fn?: () => void) {
  const getHeapSize = () => {
    // Use Node.js process.memoryUsage() for accurate memory measurement
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  };

  const beforeHeap = getHeapSize();
  const startTime = performance.now();
  
  if (fn) {
    fn();
  }
  
  const endTime = performance.now();
  const afterHeap = getHeapSize();
  
  const measurement: MemoryMeasurement = {
    beforeHeap,
    afterHeap,
    delta: afterHeap - beforeHeap,
    timestamp: Date.now()
  };

  const data = memoryData.get(benchmarkName);
  if (data) {
    if (operation === 'setup') {
      data.setup = measurement;
    } else if (operation === 'teardown') {
      data.teardown = measurement;
    } else {
      data.executions.push(measurement);
    }
  }

  return {
    ...measurement,
    executionTime: endTime - startTime
  };
}

export function getMemoryData(benchmarkName: string): BenchmarkMemoryData | undefined {
  return memoryData.get(benchmarkName);
}

export function getAllMemoryData(): Map<string, BenchmarkMemoryData> {
  return new Map(memoryData);
}

export function clearMemoryData(benchmarkName?: string) {
  if (benchmarkName) {
    memoryData.delete(benchmarkName);
  } else {
    memoryData.clear();
  }
}

export function formatMemorySize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Enhanced memory measurement for legacy compatibility
export function measureMemoryLegacy(fn: () => void) {
  const getHeapSize = () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  };
  
  const beforeMemory = getHeapSize();
  const startTime = performance.now();
  
  fn();
  
  const endTime = performance.now();
  const afterMemory = getHeapSize();
  const memoryDelta = afterMemory - beforeMemory;
  
  return {
    executionTime: endTime - startTime,
    memoryDelta,
    memoryBefore: beforeMemory,
    memoryAfter: afterMemory
  };
}