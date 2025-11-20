import { useCallback } from 'react';
import type { ContextInfo, LogEntry } from '../store/types';
import { devtoolsState } from '../store/devtoolsCtx';

interface ImportData {
  version: string;
  exportDate: string;
  state: {
    contexts?: ContextInfo[];
    logEntries?: LogEntry[];
    filter?: {
      type: string;
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
        contexts: devtoolsState.contexts(),
        logEntries: devtoolsState.logEntries(),
        filter: devtoolsState.filter(),
        selectedContext: devtoolsState.selectedContext(),
        selectedTransaction: devtoolsState.selectedTransaction(),
        selectedTab: devtoolsState.selectedTab(),
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
          devtoolsState.contexts(state.contexts);
        }

        if (state.logEntries) {
          devtoolsState.logEntries(state.logEntries);
        }

        if (state.filter) {
          devtoolsState.filter(state.filter);
        }

        if (state.selectedContext !== undefined) {
          devtoolsState.selectedContext(state.selectedContext);
        }
        if (state.selectedTransaction !== undefined) {
          devtoolsState.selectedTransaction(state.selectedTransaction);
        }
        if (state.selectedTab) {
          devtoolsState.selectedTab(state.selectedTab as 'logs' | 'timeline');
        }

        devtoolsState.connected(true);
      } catch (error) {
        console.error('Failed to import data:', error);
        alert('Failed to import data. Please check the file format.');
      }
    };
    input.click();
  }, []);

  return { handleExport, handleImport };
}
