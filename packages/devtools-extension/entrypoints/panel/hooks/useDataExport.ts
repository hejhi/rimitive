import { useCallback } from 'react';
import type {
  ContextInfo,
  Transaction,
  LogEntry,
  DependencyNode,
} from '../store/types';
import { devtoolsStore } from '../store/devtoolsCtx';

interface ImportData {
  version: string;
  exportDate: string;
  state: {
    contexts?: ContextInfo[];
    transactions?: Transaction[];
    logEntries?: LogEntry[];
    dependencyGraph?: {
      nodes?: Array<{
        id: string;
        type: 'signal' | 'computed' | 'effect';
        name?: string;
        value?: unknown;
        isActive: boolean;
        isOutdated?: boolean;
        hasSubscribers?: boolean;
      }>;
      edges?: Array<{ source: string; targets: string[] }>;
      reverseEdges?: Array<{ target: string; sources: string[] }>;
    };
    lastSnapshot?: {
      timestamp: number;
      nodes: DependencyNode[];
      edges: Array<{ source: string; target: string; isActive: boolean }>;
    };
    filter?: {
      type: 'all' | 'signal' | 'computed' | 'effect';
      search: string;
      hideInternal: boolean;
    };
    selectedContext?: string | null;
    selectedTransaction?: string | null;
    selectedTab?: string;
  };
}

export function useDataExport() {
  const handleExport = useCallback(() => {
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      state: {
        contexts: devtoolsStore.state.contexts.value,
        transactions: devtoolsStore.state.transactions.value,
        logEntries: devtoolsStore.state.logEntries.value,
        dependencyGraph: {
          nodes: Array.from(
            devtoolsStore.state.dependencyGraph.value.nodes.entries()
          ).map(([id, node]) => ({ ...node, id })),
          edges: Array.from(
            devtoolsStore.state.dependencyGraph.value.edges.entries()
          ).map(([source, targets]) => ({
            source,
            targets: Array.from(targets),
          })),
          reverseEdges: Array.from(
            devtoolsStore.state.dependencyGraph.value.reverseEdges.entries()
          ).map(([target, sources]) => ({
            target,
            sources: Array.from(sources),
          })),
        },
        lastSnapshot: devtoolsStore.state.lastSnapshot.value,
        filter: devtoolsStore.state.filter.value,
        selectedContext: devtoolsStore.state.selectedContext.value,
        selectedTransaction: devtoolsStore.state.selectedTransaction.value,
        selectedTab: devtoolsStore.state.selectedTab.value,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lattice-devtools-export-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text) as ImportData;

        if (!importData.version || !importData.state) {
          throw new Error('Invalid import file format');
        }

        const state = importData.state;

        if (state.contexts) {
          devtoolsStore.state.contexts.value = state.contexts;
        }

        if (state.transactions) {
          devtoolsStore.state.transactions.value = state.transactions;
        }

        if (state.logEntries) {
          devtoolsStore.state.logEntries.value = state.logEntries;
        }

        if (state.dependencyGraph) {
          const graph = devtoolsStore.state.dependencyGraph.value;

          graph.nodes.clear();
          graph.edges.clear();
          graph.reverseEdges.clear();

          if (state.dependencyGraph.nodes) {
            state.dependencyGraph.nodes.forEach((node) => {
              const { id, ...nodeData } = node;
              graph.nodes.set(id, nodeData as DependencyNode);
            });
          }

          if (state.dependencyGraph.edges) {
            state.dependencyGraph.edges.forEach((edge) => {
              graph.edges.set(edge.source, new Set(edge.targets));
            });
          }

          if (state.dependencyGraph.reverseEdges) {
            state.dependencyGraph.reverseEdges.forEach((edge) => {
              graph.reverseEdges.set(edge.target, new Set(edge.sources));
            });
          }

          devtoolsStore.state.dependencyGraph.value = { ...graph };
        }

        if (state.lastSnapshot) {
          devtoolsStore.state.lastSnapshot.value = state.lastSnapshot;
        }

        if (state.filter) {
          devtoolsStore.state.filter.value = state.filter;
        }

        if (state.selectedContext !== undefined) {
          devtoolsStore.state.selectedContext.value = state.selectedContext;
        }
        if (state.selectedTransaction !== undefined) {
          devtoolsStore.state.selectedTransaction.value =
            state.selectedTransaction;
        }
        if (state.selectedTab) {
          devtoolsStore.state.selectedTab.value = state.selectedTab as
            | 'logs'
            | 'timeline'
            | 'graph';
        }

        devtoolsStore.state.connected.value = true;
      } catch (error) {
        console.error('Failed to import data:', error);
        alert('Failed to import data. Please check the file format.');
      }
    };
    input.click();
  }, []);

  return { handleExport, handleImport };
}
