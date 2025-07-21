import { useSubscribe } from '@lattice/react';
import type { LogEntry } from './store/types';
import { filteredLogEntries } from './store/computed';

export function LogsTab() {
  const logs = useSubscribe(filteredLogEntries);

  return (
    <div className="h-full overflow-y-auto">
      <div className="font-mono text-xs p-4 space-y-1">
        {logs.length === 0 ? (
          <div className="text-muted-foreground text-center py-8">
            No log entries yet. Interact with your application to see reactive
            flow.
          </div>
        ) : (
          logs.map((log) => <LogEntryComponent key={log.id} entry={log} />)
        )}
      </div>
    </div>
  );
}

function LogEntryComponent({ entry }: { entry: LogEntry }) {
  const indent = '  '.repeat(entry.level);
  const timestamp = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });

  return (
    <div className="leading-relaxed">
      {/* Main log line */}
      <div className="flex items-start gap-2">
        <span className="text-muted-foreground w-[100px] flex-shrink-0">
          {timestamp}
        </span>
        <span className="flex-1">
          {indent}
          {renderLogEntry(entry)}
        </span>
      </div>
    </div>
  );
}

function renderLogEntry(entry: LogEntry): React.ReactNode {
  const name = entry.nodeName || entry.nodeId || 'anonymous';
  const eventType = entry.eventType;
  const category = entry.category;
  
  // Determine color based on category
  const colorMap: Record<string, { main: string; secondary: string }> = {
    signal: { main: 'text-blue-500', secondary: 'text-blue-400' },
    computed: { main: 'text-purple-500', secondary: 'text-purple-400' },
    effect: { main: 'text-yellow-500', secondary: 'text-yellow-400' },
    batch: { main: 'text-green-500', secondary: 'text-green-400' },
    store: { main: 'text-orange-500', secondary: 'text-orange-400' },
    selector: { main: 'text-pink-500', secondary: 'text-pink-400' },
  };
  
  const colors = colorMap[category] || { main: 'text-gray-500', secondary: 'text-gray-400' };

  return (
    <>
      <span className={colors.main}>{eventType}</span>{' '}
      <span className={colors.secondary}>{name}</span>
      {entry.summary && (
        <>
          {' '}
          <span className="text-muted-foreground">→</span>{' '}
          <span className="text-foreground">{entry.summary}</span>
        </>
      )}
    </>
  );
}