/**
 * @fileoverview Custom Vitest reporter that includes memory usage in JSON output
 */

import type { Reporter } from 'vitest/reporters';
import type { File, Task } from 'vitest';
import { promises as fs } from 'fs';
import { getAllMemoryData, formatMemorySize } from './memory-reporter.js';

interface MemoryMeasurement {
  beforeHeap: number;
  afterHeap: number;
  delta: number;
  deltaFormatted?: string;
}

interface BenchmarkMemoryData {
  setup?: MemoryMeasurement;
  teardown?: MemoryMeasurement;
  executions?: MemoryMeasurement[];
}

type EnhancedTask = Task & {
  memoryUsage?: {
    setup?: MemoryMeasurement;
    teardown?: MemoryMeasurement;
    executions?: MemoryMeasurement[];
    summary?: {
      totalMemoryDelta: number;
      totalMemoryDeltaFormatted: string;
      avgExecutionDelta: number;
      avgExecutionDeltaFormatted: string;
    };
  };
  tasks?: EnhancedTask[];
}

export class MemoryJsonReporter implements Reporter {
  private outputFile?: string;

  constructor(options: { outputFile?: string } = {}) {
    this.outputFile = options.outputFile;
  }

  onInit() {
    // Reporter initialized
  }

  async onFinished(files: File[] = []) {
    if (!this.outputFile) return;

    const memoryData = getAllMemoryData();

    // Enhance results with memory data
    const enhancedFiles = files.map((file) => ({
      ...file,
      tasks: file.tasks?.map((task: Task) =>
        this.enhanceTaskWithMemory(task, memoryData)
      ) as EnhancedTask[] | undefined,
    }));

    // Create enhanced benchmark report
    const report = {
      files: enhancedFiles,
      memoryTracking: {
        enabled: memoryData.size > 0,
        totalBenchmarks: memoryData.size,
        summary: this.createMemorySummary(memoryData),
      },
    };

    try {
      await fs.writeFile(this.outputFile, JSON.stringify(report, null, 2));
    } catch (error) {
      console.error(
        'Failed to write memory-enhanced benchmark results:',
        error
      );
    }
  }

  private enhanceTaskWithMemory(
    task: Task,
    memoryData: Map<string, BenchmarkMemoryData>
  ): EnhancedTask {
    if (!task || typeof task !== 'object') {
      return task as EnhancedTask;
    }

    const enhancedTask = { ...task } as EnhancedTask;

    // Handle tasks with subtasks (suites)
    if ('tasks' in task && Array.isArray(task.tasks)) {
      enhancedTask.tasks = task.tasks.map((subtask) =>
        this.enhanceTaskWithMemory(subtask, memoryData)
      );
    }

    // Handle benchmark tasks
    if (task.type === 'test' && task.name) {
      const benchmarkName = task.name;
      const benchmarkMemory = memoryData.get(benchmarkName);
      if (!benchmarkMemory) {
        return enhancedTask;
      }

    const memoryUsage: EnhancedTask['memoryUsage'] = {};

    if (benchmarkMemory.setup) {
      memoryUsage.setup = {
        beforeHeap: benchmarkMemory.setup.beforeHeap,
        afterHeap: benchmarkMemory.setup.afterHeap,
        delta: benchmarkMemory.setup.delta,
        deltaFormatted: formatMemorySize(benchmarkMemory.setup.delta),
      };
    }

    if (benchmarkMemory.teardown) {
      memoryUsage.teardown = {
        beforeHeap: benchmarkMemory.teardown.beforeHeap,
        afterHeap: benchmarkMemory.teardown.afterHeap,
        delta: benchmarkMemory.teardown.delta,
        deltaFormatted: formatMemorySize(benchmarkMemory.teardown.delta),
      };
    }

    if (benchmarkMemory.executions && benchmarkMemory.executions.length > 0) {
      memoryUsage.executions = benchmarkMemory.executions.map((exec) => ({
        beforeHeap: exec.beforeHeap,
        afterHeap: exec.afterHeap,
        delta: exec.delta,
        deltaFormatted: formatMemorySize(exec.delta),
      }));

      // Calculate summary statistics
      const totalDelta = benchmarkMemory.executions.reduce(
        (sum, exec) => sum + exec.delta,
        0
      );
      const avgDelta = totalDelta / benchmarkMemory.executions.length;

      memoryUsage.summary = {
        totalMemoryDelta: totalDelta,
        totalMemoryDeltaFormatted: formatMemorySize(totalDelta),
        avgExecutionDelta: avgDelta,
        avgExecutionDeltaFormatted: formatMemorySize(avgDelta),
      };
    }

      enhancedTask.memoryUsage = memoryUsage;
    }

    return enhancedTask;
  }

  private createMemorySummary(memoryData: Map<string, BenchmarkMemoryData>) {
    const summary = {
      benchmarksWithMemoryData: 0,
      totalSetupMemory: 0,
      totalTeardownMemory: 0,
      totalExecutionMemory: 0,
    };

    for (const [, data] of memoryData) {
      summary.benchmarksWithMemoryData++;

      if (data.setup) {
        summary.totalSetupMemory += data.setup.delta;
      }

      if (data.teardown) {
        summary.totalTeardownMemory += data.teardown.delta;
      }

      if (data.executions && data.executions.length > 0) {
        summary.totalExecutionMemory += data.executions.reduce(
          (sum, exec) => sum + exec.delta,
          0
        );
      }
    }

    return {
      ...summary,
      totalSetupMemoryFormatted: formatMemorySize(summary.totalSetupMemory),
      totalTeardownMemoryFormatted: formatMemorySize(
        summary.totalTeardownMemory
      ),
      totalExecutionMemoryFormatted: formatMemorySize(
        summary.totalExecutionMemory
      ),
    };
  }
}
