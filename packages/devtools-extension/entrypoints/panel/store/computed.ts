import { devtoolsContext, devtoolsState } from './devtoolsCtx';
import type { LogEntry } from './types';

// Common log filtering logic
function filterLogs(
  logs: LogEntry[],
  filter: { type: string; search: string; hideInternal: boolean; nodeId: string | null },
  selectedContext: string | null,
  searchIn: string[]
) {
  return logs.filter((log) => {
    // Context filter
    if (selectedContext && log.contextId !== selectedContext) return false;

    // Node ID filter (click-to-filter)
    if (filter.nodeId && log.nodeId !== filter.nodeId) return false;

    // Type filter
    if (filter.type !== 'all' && log.category !== filter.type) return false;

    // Search filter
    if (filter.search) {
      const search = filter.search.toLowerCase();
      const searchTargets = searchIn.map((field) => {
        if (field === 'eventType') return log.eventType;
        if (field === 'nodeName') return log.nodeName || '';
        if (field === 'nodeId') return log.nodeId || '';
        if (field === 'data') return JSON.stringify(log.data);
        if (field === 'summary') return log.summary || '';
        return '';
      });

      if (
        !searchTargets.some((target) => target.toLowerCase().includes(search))
      ) {
        return false;
      }
    }

    // Hide internal events if requested
    if (filter.hideInternal && log.isInternal) {
      return false;
    }

    return true;
  });
}

// Actual computed values that transform or aggregate data
export const filteredTransactions = devtoolsContext.computed(() => {
  const logEntries = devtoolsState.logEntries();
  const filter = devtoolsState.filter();
  const selectedContext = devtoolsState.selectedContext();

  return filterLogs(logEntries, filter, selectedContext, [
    'eventType',
    'nodeName',
    'summary',
  ]);
});

export const selectedContextData = devtoolsContext.computed(() => {
  const selectedId = devtoolsState.selectedContext();
  if (!selectedId) return null;

  return devtoolsState.contexts().find((c) => c.id === selectedId);
});

// Selected item data
export const selectedTransactionData = devtoolsContext.computed(() => {
  const selectedId = devtoolsState.selectedTransaction();
  if (!selectedId) return null;

  return filteredTransactions().find((log) => log.id === selectedId) || null;
});

export const filteredLogEntries = devtoolsContext.computed(() => {
  const logs = devtoolsState.logEntries();
  const filter = devtoolsState.filter();
  const selectedContext = devtoolsState.selectedContext();

  const filtered = filterLogs(logs, filter, selectedContext, [
    'nodeName',
    'summary',
  ]);
  return filtered.slice(-500); // Keep last 500 logs
});
