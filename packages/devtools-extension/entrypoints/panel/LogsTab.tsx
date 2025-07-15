import { useSignal } from './useLattice';
import {
  ComputedCompleteLogDetails,
  ComputedRunLogDetails,
  EffectCompleteLogDetails,
  SELECTOR_CREATED,
  SelectorCreatedLogDetails,
  SIGNAL_WRITE,
  SignalReadLogDetails,
  SignalWriteLogDetails,
  type LogEntry,
} from './store/types';
import { filteredLogEntries } from './store/computed';

export function LogsTab() {
  const logs = useSignal(filteredLogEntries);

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

      {/* Additional detail lines */}
      {renderLogDetails(entry, indent)}
    </div>
  );
}

function renderLogEntry(entry: LogEntry): React.ReactNode {
  const name = entry.nodeName || entry.nodeId;

  switch (entry.type) {
    case 'signal-write':
      return (
        <>
          <span className="text-blue-500">SIGNAL_WRITE</span>{' '}
          <span className="text-blue-400">{name}</span>
        </>
      );

    case 'signal-read':
      return (
        <>
          <span className="text-emerald-500">SIGNAL_READ</span>{' '}
          <span className="text-emerald-400">{name}</span>
        </>
      );

    case 'computed-run':
      return (
        <>
          <span className="text-purple-500">COMPUTE_RUN</span>{' '}
          <span className="text-purple-400">{name}</span>
        </>
      );

    case 'computed-complete':
      return (
        <>
          <span className="text-purple-500">COMPUTE_COMPLETE</span>{' '}
          <span className="text-purple-400">{name}</span>
        </>
      );

    case 'effect-run':
      return (
        <>
          <span className="text-orange-500">EFFECT_RUN</span>{' '}
          <span className="text-orange-400">{name}</span>
        </>
      );

    case 'effect-complete':
      return (
        <>
          <span className="text-orange-500">EFFECT_COMPLETE</span>{' '}
          <span className="text-orange-400">{name}</span>
        </>
      );

    case 'selector-created':
      return (
        <>
          <span className="text-red-500">SELECTOR_CREATED</span>{' '}
          <span className="text-red-400">{name}</span>
        </>
      );

    default:
      return <span className="text-gray-500">{entry.type}</span>;
  }
}

function renderLogDetails(
  entry: LogEntry,
  baseIndent: string
): React.ReactNode {
  const indent = baseIndent + '  ';

  switch (entry.type) {
    case SIGNAL_WRITE: {
      const details = entry.details as SignalWriteLogDetails;
      return (
        <>
          <div className="text-muted-foreground">
            <span className="w-[100px] inline-block" />
            {indent}Update value: {JSON.stringify(details.oldValue)} →{' '}
            {JSON.stringify(details.newValue)}
          </div>
          {details.triggeredDependencies.length > 0 && (
            <div className="text-muted-foreground">
              <span className="w-[100px] inline-block" />
              {indent}Triggering {details.triggeredDependencies.length}{' '}
              direct/indirect dependencies...
            </div>
          )}
        </>
      );
    }

    case 'signal-read': {
      const details = entry.details as SignalReadLogDetails;
      return (
        <>
          <div className="text-muted-foreground">
            <span className="w-[100px] inline-block" />
            {indent}Read by {details.readByName || details.readBy}
          </div>
          <div className="text-muted-foreground">
            <span className="w-[100px] inline-block" />
            {indent}Returned value: {JSON.stringify(details.value)}
          </div>
        </>
      );
    }

    case 'computed-run': {
      const details = entry.details as ComputedRunLogDetails;
      if (details.triggeredBy.length > 0) {
        return (
          <div className="text-muted-foreground">
            <span className="w-[100px] inline-block" />
            {indent}Computing new value...
          </div>
        );
      }
      return null;
    }

    case 'computed-complete': {
      const details = entry.details as ComputedCompleteLogDetails;
      return (
        <>
          {details.oldValue !== undefined && (
            <div className="text-muted-foreground">
              <span className="w-[100px] inline-block" />
              {indent}Update value: {JSON.stringify(details.oldValue)} →{' '}
              {JSON.stringify(details.value)}
            </div>
          )}
          <div className="text-muted-foreground">
            <span className="w-[100px] inline-block" />
            {indent}Duration: {details.duration}ms
          </div>
        </>
      );
    }

    case 'effect-run': {
      return null; // No additional details for effect run
    }

    case 'effect-complete': {
      const details = entry.details as EffectCompleteLogDetails;
      return (
        <div className="text-muted-foreground">
          <span className="w-[100px] inline-block" />
          {indent}Duration: {details.duration}ms
        </div>
      );
    }

    case SELECTOR_CREATED: {
      const details = entry.details as SelectorCreatedLogDetails;
      return (
        <>
          <div className="text-muted-foreground">
            <span className="w-[100px] inline-block" />
            {indent}Source: {details.sourceName || details.sourceId} ({details.sourceType})
          </div>
          <div className="text-muted-foreground">
            <span className="w-[100px] inline-block" />
            {indent}Selector: {details.selector}
          </div>
        </>
      );
    }

    default:
      return null;
  }
}
