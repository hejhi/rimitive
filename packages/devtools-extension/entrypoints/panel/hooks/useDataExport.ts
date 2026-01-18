import { useCallback } from 'react';
import type { ContextInfo, LogEntry } from '../store/types';
import { devtoolsState } from '../store/devtoolsCtx';

type ImportData = {
  version: string;
  exportDate: string;
  state: {
    contexts?: ContextInfo[];
    logEntries?: LogEntry[];
    filter?: {
      type: string;
      search: string;
      hideInternal: boolean;
      nodeId?: string | null;
    };
    selectedContext?: string | null;
    selectedTransaction?: string | null;
  };
};

export function useDataExport() {
  const handleExport = useCallback(() => {
    const filter = devtoolsState.filter();
    const selectedContext = devtoolsState.selectedContext();
    const allContexts = devtoolsState.contexts();
    let logEntries = devtoolsState.logEntries();

    // Filter by selected context if one is selected
    if (selectedContext) {
      logEntries = logEntries.filter(
        (entry) => entry.contextId === selectedContext
      );
    }

    // Filter out internal entries if hideInternal is enabled
    if (filter.hideInternal) {
      logEntries = logEntries.filter((entry) => !entry.isInternal);
    }

    // Export only the selected context, or all contexts if none selected
    const contexts = selectedContext
      ? allContexts.filter((c) => c.id === selectedContext)
      : allContexts;

    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      state: {
        contexts,
        logEntries,
        filter,
        selectedContext,
        selectedTransaction: devtoolsState.selectedTransaction(),
      },
    };

    // Generate filename based on selection
    const contextName = selectedContext
      ? contexts[0]?.name?.toLowerCase().replace(/\s+/g, '-') ?? 'service'
      : 'all';
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rimitive-${contextName}-${Date.now()}.json`;
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

        // Open snapshot modal instead of replacing live data
        devtoolsState.snapshot({
          contexts: state.contexts ?? [],
          logEntries: state.logEntries ?? [],
          exportDate: importData.exportDate,
        });

        // Select the first context if there's only one, or none if multiple
        if (state.contexts && state.contexts.length === 1) {
          devtoolsState.snapshotSelectedContext(state.contexts[0].id);
        } else {
          devtoolsState.snapshotSelectedContext(null);
        }
      } catch (error) {
        console.error('Failed to import data:', error);
        alert('Failed to import data. Please check the file format.');
      }
    };
    input.click();
  }, []);

  return { handleExport, handleImport };
}
