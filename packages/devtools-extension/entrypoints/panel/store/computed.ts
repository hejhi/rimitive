import { devtoolsContext, devtoolsState } from './devtoolsCtx';

// Common log filtering logic
function filterLogs(
  logs: typeof devtoolsState.logEntries.value,
  filter: typeof devtoolsState.filter.value,
  selectedContext: string | null,
  searchIn: string[]
) {
  return logs.filter((log) => {
    // Context filter
    if (selectedContext && log.contextId !== selectedContext) return false;

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

    // Internal reads filter
    if (filter.hideInternal && log.eventType === 'SIGNAL_READ') {
      const data = log.data;
      return !data.internal;
    }

    return true;
  });
}

// Actual computed values that transform or aggregate data
export const filteredTransactions = devtoolsContext.computed(() => {
  const logEntries = devtoolsState.logEntries.value;
  const filter = devtoolsState.filter.value;
  const selectedContext = devtoolsState.selectedContext.value;

  const filtered = filterLogs(logEntries, filter, selectedContext, [
    'eventType',
    'nodeName',
    'data',
  ]);

  // Timeline view filters - show only main events, not start/end pairs
  return filtered.filter(
    (log) =>
      !log.eventType.includes('_START') &&
      !log.eventType.includes('_BEGIN')
  );
});

export const selectedContextData = devtoolsContext.computed(() => {
  const selectedId = devtoolsState.selectedContext.value;
  if (!selectedId) return null;

  return devtoolsState.contexts.value.find((c) => c.id === selectedId);
});

// Selected item data
export const selectedTransactionData = devtoolsContext.computed(() => {
  const selectedId = devtoolsState.selectedTransaction.value;
  if (!selectedId) return null;

  return (
    filteredTransactions.value.find((log) => log.id === selectedId) || null
  );
});

export const filteredLogEntries = devtoolsContext.computed(() => {
  const logs = devtoolsState.logEntries.value;
  const filter = devtoolsState.filter.value;
  const selectedContext = devtoolsState.selectedContext.value;

  const filtered = filterLogs(logs, filter, selectedContext, [
    'nodeName',
    'nodeId',
    'data',
    'summary',
  ]);
  return filtered.slice(-500); // Keep last 500 logs
});
