import { useState } from 'react';
import { ChevronRight, ChevronDown, Network } from 'lucide-react';
import type { LogEntry, SourceLocation } from '../store/types';
import { getCategoryColors } from '../store/eventTypeManager';
import { devtoolsState } from '../store/devtoolsCtx';
import { selectedNodeId, navigateToGraphNode } from '../store/graphState';
import { ValueDisplay, isExpandableValue } from './ValueDisplay';

type LogLineProps = {
  entry: LogEntry;
  leftColumn: string;
  indent?: number;
};

export function LogLine({ entry, leftColumn, indent = 0 }: LogLineProps) {
  const [expanded, setExpanded] = useState(false);
  const indentPx = indent * 12;

  // Check if this entry has expandable content
  const expandable = entry.summary ? isExpandableValue(entry.summary) : false;

  return (
    <div className="leading-relaxed grid grid-cols-[auto_1fr] gap-x-3 items-start">
      {/* Left column - timestamp/delta */}
      <span className="text-muted-foreground whitespace-nowrap">
        {leftColumn}
      </span>

      {/* Right column - content */}
      <div className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
        {/* Indent spacer */}
        {indentPx > 0 && <span style={{ width: indentPx, display: 'inline-block' }} />}

        {/* Expand toggle - only if expandable */}
        {expandable ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center justify-center w-4 h-4 align-middle text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <span className="inline-block w-4" />
        )}

        <LogContent entry={entry} expanded={expanded} />
      </div>

      {/* Expanded content - spans both columns, below main row */}
      {expanded && entry.summary && (
        <>
          <span /> {/* Empty cell for grid alignment */}
          <div className="ml-5 mt-1 border-l border-border/30 pl-3 whitespace-normal">
            <ValueDisplay value={entry.summary} mode="expanded" />
          </div>
        </>
      )}
    </div>
  );
}

type LogContentProps = {
  entry: LogEntry;
  expanded: boolean;
};

function LogContent({ entry, expanded }: LogContentProps) {
  const name = entry.nodeName || entry.nodeId || 'anonymous';
  const eventType = entry.eventType;
  const category = entry.category;
  const nodeId = entry.nodeId;
  const sourceLocation = entry.sourceLocation;

  const colors = getCategoryColors(category);

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
          className={`${colors.secondary} underline decoration-current/30 hover:decoration-current cursor-pointer`}
          title={title}
        >
          {name}
        </button>
      ) : (
        <span className={colors.secondary}>{name}</span>
      )}
      {nodeId && (
        <button
          onClick={() => navigateToGraphNode(nodeId)}
          className="inline-flex items-center justify-center w-4 h-4 ml-1 align-middle text-muted-foreground/40 hover:text-accent transition-colors"
          title="View in graph"
        >
          <Network className="w-3 h-3" />
        </button>
      )}
      {entry.summary && (
        <>
          {' '}<span className="text-muted-foreground">→</span>{' '}
          <ValueDisplay value={entry.summary} mode={expanded ? 'collapsed-no-preview' : 'collapsed'} />
        </>
      )}
    </>
  );
}

function openInEditor(location: SourceLocation) {
  chrome.devtools.panels.openResource(
    location.filePath,
    location.line - 1,
    location.column ?? 0,
    () => {}
  );
}

function filterByNodeId(nodeId: string) {
  const currentFilter = devtoolsState.filter();
  devtoolsState.filter({
    ...currentFilter,
    nodeId,
  });
  selectedNodeId(nodeId);
}

function handleNodeClick(
  e: React.MouseEvent,
  nodeId: string | undefined,
  sourceLocation: SourceLocation | undefined
) {
  if (e.metaKey || e.ctrlKey) {
    if (nodeId) {
      filterByNodeId(nodeId);
    }
    return;
  }

  if (sourceLocation) {
    openInEditor(sourceLocation);
  }
}
