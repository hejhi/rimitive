import { useSubscribe } from '@rimitive/react';
import type { LogEntry } from './store/types';
import { filteredLogEntries } from './store/computed';
import { LogLine } from './components/LogLine';

type LogsTabProps = {
  /** Optional mode indicator for snapshot viewing */
  snapshotMode?: boolean;
  /** Optional log entries to display. If not provided, uses global filtered entries. */
  logEntries?: LogEntry[];
};

export function LogsTab({ logEntries }: LogsTabProps = {}) {
  // Use provided entries or fall back to global computed
  const globalLogs = useSubscribe(filteredLogEntries);
  const logs = logEntries ?? globalLogs;

  return (
    <div className="h-full overflow-y-auto">
      <div className="font-mono text-xs p-4 space-y-1">
        {logs.length === 0 ? (
          <div className="text-muted-foreground text-center py-8">
            No log entries yet. Interact with your application to see reactive
            flow.
          </div>
        ) : (
          logs.map((log) => <LogEntryRow key={log.id} entry={log} />)
        )}
      </div>
    </div>
  );
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const timestamp = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });

  return <LogLine entry={entry} leftColumn={timestamp} indent={entry.level} />;
}
