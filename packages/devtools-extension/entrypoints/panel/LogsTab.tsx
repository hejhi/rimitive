import { useSubscribe } from '@rimitive/react';
import type { LogEntry, SourceLocation } from './store/types';
import { filteredLogEntries } from './store/computed';
import { getCategoryColors } from './store/eventTypeManager';
import { devtoolsState } from './store/devtoolsCtx';

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

/**
 * Open source file in Chrome DevTools Sources panel
 */
function openInEditor(location: SourceLocation) {
  // Source location is already resolved when log entry was created
  // Use Chrome DevTools API to open the resource in Sources panel
  // openResource uses 0-based line numbers, source maps use 1-based
  chrome.devtools.panels.openResource(
    location.filePath,
    location.line - 1,
    location.column ?? 0,
    () => {
      // Callback when resource is opened (or fails silently)
    }
  );
}

/**
 * Filter logs by node ID
 */
function filterByNodeId(nodeId: string) {
  const currentFilter = devtoolsState.filter();
  devtoolsState.filter({
    ...currentFilter,
    nodeId,
  });
}

/**
 * Handle click on node name
 * - Click: open source in editor (if source location available)
 * - Cmd/Ctrl+Click: filter by node ID
 */
function handleNodeClick(
  e: React.MouseEvent,
  nodeId: string | undefined,
  sourceLocation: SourceLocation | undefined
) {
  // Cmd/Ctrl+Click: filter by node ID
  if (e.metaKey || e.ctrlKey) {
    if (nodeId) {
      filterByNodeId(nodeId);
    }
    return;
  }

  // Regular click: open source in editor
  if (sourceLocation) {
    openInEditor(sourceLocation);
  }
}

function renderLogEntry(entry: LogEntry): React.ReactNode {
  const name = entry.nodeName || entry.nodeId || 'anonymous';
  const eventType = entry.eventType;
  const category = entry.category;
  const nodeId = entry.nodeId;
  const sourceLocation = entry.sourceLocation;

  // Get dynamic colors for this category
  const colors = getCategoryColors(category);

  // Determine if clickable and build title
  const isClickable = sourceLocation || nodeId;
  const titleParts: string[] = [];
  if (sourceLocation) titleParts.push('Click to open in editor');
  if (nodeId) titleParts.push('⌘+Click to filter');
  const title = titleParts.join(' · ');

  return (
    <>
      <span className={colors.main}>{eventType}</span>{' '}
      {isClickable ? (
        <button
          onClick={(e) => handleNodeClick(e, nodeId, sourceLocation)}
          className={`${colors.secondary} hover:underline cursor-pointer`}
          title={title}
        >
          {name}
        </button>
      ) : (
        <span className={colors.secondary}>{name}</span>
      )}
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
