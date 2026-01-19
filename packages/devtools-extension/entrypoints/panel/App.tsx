import { lazy, Suspense } from 'react';
import { useSubscribe } from '@rimitive/react';
import { Trash2, List, Network, Loader2, History } from 'lucide-react';
import { Button } from '../../src/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../src/components/ui/tabs';
import { LogsTab } from './LogsTab';
import { ConnectionStatus, FilterBar, Header } from './components';
import { SnapshotModal } from './components/SnapshotModal';
import { useDataExport, useDevToolsConnection } from './hooks';
import { useDevtools } from './store/DevtoolsProvider';

// Lazy load GraphTab (includes React Flow ~200KB)
const GraphTab = lazy(() => import('./GraphTab').then((m) => ({ default: m.GraphTab })));

// Lazy load TimelineTab
const TimelineTab = lazy(() => import('./TimelineTab').then((m) => ({ default: m.TimelineTab })));

function GraphTabLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 text-muted-foreground/40 mx-auto animate-spin" />
        <div className="text-muted-foreground text-sm">Loading graph...</div>
      </div>
    </div>
  );
}

export function App() {
  const devtools = useDevtools();
  const connected = useSubscribe(devtools.connected);
  const connectionStatus = useSubscribe(devtools.connectionStatus);
  const contexts = useSubscribe(devtools.contexts);
  const selectedContext = useSubscribe(devtools.selectedContext);
  const filter = useSubscribe(devtools.filter);
  const activeTab = useSubscribe(devtools.activeTab);

  const { handleExport, handleImport } = useDataExport();
  useDevToolsConnection();

  // Show ConnectionStatus only if truly disconnected (not reconnecting)
  // During reconnection, keep showing the main view with existing data
  if (!connected && connectionStatus !== 'reconnecting') {
    return <ConnectionStatus />;
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <Header
        contexts={contexts}
        selectedContext={selectedContext}
        onContextChange={(value) => devtools.selectedContext(value)}
        onExport={handleExport}
        onImport={handleImport}
      />

      <Tabs value={activeTab} onValueChange={(v) => devtools.activeTab(v as 'logs' | 'graph' | 'timeline')} className="flex-1 flex flex-col overflow-hidden">
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              devtools.logEntries([]);
              devtools.selectedTransaction(null);
              // Reset graph state
              devtools.graphNodes(new Map());
              devtools.graphEdges(new Map());
              devtools.graphDependencies(new Map());
              devtools.graphDependents(new Map());
              devtools.selectedNodeId(null);
              devtools.viewMode('full');
              devtools.hoveredNodeId(null);
              // Reset timeline state
              devtools.timelineState({
                cascades: [],
                currentCascadeIndex: null,
                timeRange: null,
              });
            }}
            title="Clear all events and graph"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Filter bar (shown for logs tab) */}
        <TabsContent value="logs" className="flex-1 flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b">
            <FilterBar
              filterType={filter.type}
              searchValue={filter.search}
              filteredNodeId={filter.nodeId}
              onFilterTypeChange={(value) =>
                devtools.filter({
                  ...devtools.filter.peek(),
                  type: value,
                })
              }
              onSearchChange={(value) =>
                devtools.filter({
                  ...devtools.filter.peek(),
                  search: value,
                })
              }
              onClearNodeFilter={() =>
                devtools.filter({
                  ...devtools.filter.peek(),
                  nodeId: null,
                })
              }
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <LogsTab />
          </div>
        </TabsContent>

        <TabsContent value="graph" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
          <Suspense fallback={<GraphTabLoading />}>
            <GraphTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
          <Suspense fallback={<GraphTabLoading />}>
            <TimelineTab />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Snapshot modal overlay */}
      <SnapshotModal />
    </div>
  );
}
