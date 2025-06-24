/**
 * @fileoverview Custom Vitest reporter that includes memory usage in JSON output
 */

import type { Reporter } from 'vitest/reporters';
import { promises as fs } from 'fs';
import { getAllMemoryData, formatMemorySize } from './memory-reporter.js';

export class MemoryJsonReporter implements Reporter {
  private outputFile?: string;

  constructor(options: { outputFile?: string } = {}) {
    this.outputFile = options.outputFile;
  }

  onInit() {
    // Reporter initialized
  }

  async onFinished(files: any[]) {
    if (!this.outputFile) return;

    const memoryData = getAllMemoryData();

    // Enhance results with memory data
    const enhancedFiles = files.map((file) => ({
      ...file,
      tasks: file.tasks?.map((task: any) =>
        this.enhanceTaskWithMemory(task, memoryData)
      ),
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

  private enhanceTaskWithMemory(task: any, memoryData: Map<string, any>): any {
    if (task.type !== 'benchmark') {
      return {
        ...task,
        tasks: task.tasks?.map((subtask: any) =>
          this.enhanceTaskWithMemory(subtask, memoryData)
        ),
      };
    }

    const benchmarkMemory = memoryData.get(task.name);
    if (!benchmarkMemory) {
      return task;
    }

    const memoryUsage: any = {};

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

    if (benchmarkMemory.executions?.length > 0) {
      memoryUsage.executions = benchmarkMemory.executions.map((exec: any) => ({
        beforeHeap: exec.beforeHeap,
        afterHeap: exec.afterHeap,
        delta: exec.delta,
        deltaFormatted: formatMemorySize(exec.delta),
      }));

      // Calculate summary statistics
      const totalDelta = benchmarkMemory.executions.reduce(
        (sum: number, exec: any) => sum + exec.delta,
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

    return {
      ...task,
      memoryUsage,
    };
  }

  private createMemorySummary(memoryData: Map<string, any>) {
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

      if (data.executions?.length > 0) {
        summary.totalExecutionMemory += data.executions.reduce(
          (sum: number, exec: any) => sum + exec.delta,
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
