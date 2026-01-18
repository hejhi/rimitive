import { lazy, Suspense, useMemo, useState, useEffect } from 'react';
import { useSubscribe } from '@rimitive/react';
import { List, Network, Loader2, History, X, Camera } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../src/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../src/components/ui/select';
import { devtoolsState, type TabId } from '../store/devtoolsCtx';
import { LogsTab } from '../LogsTab';
import { FilterBar } from './FilterBar';
import { buildGraphStateFromLogEntries } from '../store/snapshotGraphBuilder';

// Lazy load GraphTab
const GraphTab = lazy(() => import('../GraphTab').then((m) => ({ default: m.GraphTab })));

// Lazy load TimelineTab
const TimelineTab = lazy(() => import('../TimelineTab').then((m) => ({ default: m.TimelineTab })));

const ANIMATION_DURATION = 200;

function TabLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 text-muted-foreground/40 mx-auto animate-spin" />
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    </div>
  );
}

export function SnapshotModal() {
  const snapshot = useSubscribe(devtoolsState.snapshot);
  const selectedContext = useSubscribe(devtoolsState.snapshotSelectedContext);
  const filter = useSubscribe(devtoolsState.snapshotFilter);
  const activeTab = useSubscribe(devtoolsState.snapshotActiveTab);

  // Animation state
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Trigger enter animation when snapshot becomes available
  useEffect(() => {
    if (snapshot && !isClosing) {
      // Small delay to ensure the DOM is ready for animation
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }
  }, [snapshot, isClosing]);

  // Base entries filtered by context only (for graph and timeline)
  const contextFilteredEntries = useMemo(() => {
    if (!snapshot) return [];
    let entries = snapshot.logEntries;

    // Filter by selected context
    if (selectedContext) {
      entries = entries.filter((e) => e.contextId === selectedContext);
    }

    return entries;
  }, [snapshot, selectedContext]);

  // Filter log entries for the logs view (all filters applied)
  const filteredLogEntries = useMemo(() => {
    let entries = contextFilteredEntries;

    // Filter by hideInternal
    if (filter.hideInternal) {
      entries = entries.filter((e) => !e.isInternal);
    }

    // Filter by type
    if (filter.type !== 'all') {
      entries = entries.filter((e) => e.eventType === filter.type);
    }

    // Filter by search
    if (filter.search) {
      const search = filter.search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.nodeName?.toLowerCase().includes(search) ||
          e.summary?.toLowerCase().includes(search) ||
          e.nodeId?.toLowerCase().includes(search)
      );
    }

    // Filter by nodeId
    if (filter.nodeId) {
      entries = entries.filter((e) => e.nodeId === filter.nodeId);
    }

    return entries;
  }, [contextFilteredEntries, filter]);

  // Build graph state from context-filtered entries
  const snapshotGraphState = useMemo(() => {
    return buildGraphStateFromLogEntries(contextFilteredEntries);
  }, [contextFilteredEntries]);

  if (!snapshot) return null;

  const contexts = snapshot.contexts;

  // Get display name for current selection
  const selectedName = selectedContext
    ? contexts.find((c) => c.id === selectedContext)?.name ?? 'Unknown'
    : `All (${contexts.length})`;

  const handleClose = () => {
    // Start exit animation
    setIsClosing(true);
    setIsVisible(false);

    // Wait for animation to complete before clearing state
    setTimeout(() => {
      devtoolsState.snapshot(null);
      devtoolsState.snapshotSelectedContext(null);
      devtoolsState.snapshotSelectedTransaction(null);
      devtoolsState.snapshotFilter({
        type: 'all',
        search: '',
        hideInternal: true,
        nodeId: null,
      });
      devtoolsState.snapshotActiveTab('logs');
      setIsClosing(false);
    }, ANIMATION_DURATION);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col transition-transform ease-out"
      style={{
        transitionDuration: `${ANIMATION_DURATION}ms`,
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
      }}
    >
      {/* Snapshot banner */}
      <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-amber-200">
          <Camera className="h-3.5 w-3.5" />
          <span className="font-medium">Viewing Snapshot</span>
          <span className="text-amber-200/60">
            {new Date(snapshot.exportDate).toLocaleDateString()} at {new Date(snapshot.exportDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="flex items-center gap-1.5 text-xs text-amber-200 hover:text-amber-100 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          <span>Close</span>
        </button>
      </div>

      {/* Header */}
      <header className="border-b flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <img
            src="/logo-dark.svg"
            alt="Rimitive"
            className="h-3.5 dark:block hidden"
          />
          <img src="/logo.svg" alt="Rimitive" className="h-3.5 dark:hidden" />
          <h1 className="font-semibold">Rimitive DevTools</h1>
          <Select
            value={selectedContext || 'all'}
            onValueChange={(value) =>
              devtoolsState.snapshotSelectedContext(value === 'all' ? null : value)
            }
          >
            <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs gap-1.5">
              <SelectValue>{selectedName}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({contexts.length})</SelectItem>
              {contexts.map((ctx) => (
                <SelectItem key={ctx.id} value={ctx.id}>
                  {ctx.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={filter.hideInternal}
            onChange={(e) =>
              devtoolsState.snapshotFilter({ ...filter, hideInternal: e.target.checked })
            }
            className="rounded border-muted-foreground/50 w-3 h-3"
          />
          Hide internal
        </label>
      </header>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => devtoolsState.snapshotActiveTab(v as TabId)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* Tab list with actions */}
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <TabsList className="h-8">
            <TabsTrigger value="logs" className="text-xs gap-1.5 h-7 px-3">
              <List className="h-3.5 w-3.5" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="graph" className="text-xs gap-1.5 h-7 px-3">
              <Network className="h-3.5 w-3.5" />
              Graph
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs gap-1.5 h-7 px-3">
              <History className="h-3.5 w-3.5" />
              Timeline
            </TabsTrigger>
          </TabsList>
          <div className="text-xs text-muted-foreground">
            {filteredLogEntries.length} events
          </div>
        </div>

        {/* Filter bar (shown for logs tab) */}
        <TabsContent value="logs" className="flex-1 flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b">
            <FilterBar
              filterType={filter.type}
              searchValue={filter.search}
              filteredNodeId={filter.nodeId}
              onFilterTypeChange={(value) =>
                devtoolsState.snapshotFilter({
                  ...filter,
                  type: value,
                })
              }
              onSearchChange={(value) =>
                devtoolsState.snapshotFilter({
                  ...filter,
                  search: value,
                })
              }
              onClearNodeFilter={() =>
                devtoolsState.snapshotFilter({
                  ...filter,
                  nodeId: null,
                })
              }
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <LogsTab snapshotMode logEntries={filteredLogEntries} />
          </div>
        </TabsContent>

        <TabsContent value="graph" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
          <Suspense fallback={<TabLoading />}>
            <GraphTab graphState={snapshotGraphState} hideInternal={filter.hideInternal} />
          </Suspense>
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
          <Suspense fallback={<TabLoading />}>
            <TimelineTab snapshotMode logEntries={contextFilteredEntries} hideInternal={filter.hideInternal} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
