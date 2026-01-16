import { useSubscribe } from '@rimitive/react';
import { Trash2, List, Network } from 'lucide-react';
import { Button } from '../../src/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../src/components/ui/tabs';
import { LogsTab } from './LogsTab';
import { GraphTab } from './GraphTab';
import { ConnectionStatus, FilterBar, Header } from './components';
import { useDataExport, useDevToolsConnection } from './hooks';
import { devtoolsState } from './store/devtoolsCtx';
import { clearGraph } from './store/graphState';

export function App() {
  const connected = useSubscribe(devtoolsState.connected);
  const connectionStatus = useSubscribe(devtoolsState.connectionStatus);
  const contexts = useSubscribe(devtoolsState.contexts);
  const filter = useSubscribe(devtoolsState.filter);

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
        contextCount={contexts.length}
        onExport={handleExport}
        onImport={handleImport}
      />

      <Tabs defaultValue="logs" className="flex-1 flex flex-col overflow-hidden">
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
          </TabsList>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              devtoolsState.logEntries([]);
              devtoolsState.selectedTransaction(null);
              clearGraph();
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
              contexts={contexts}
              selectedContext={devtoolsState.selectedContext()}
              filterType={filter.type}
              searchValue={filter.search}
              filteredNodeId={filter.nodeId}
              hideInternal={filter.hideInternal}
              onContextChange={(value) => devtoolsState.selectedContext(value)}
              onFilterTypeChange={(value) =>
                devtoolsState.filter({
                  ...devtoolsState.filter(),
                  type: value,
                })
              }
              onSearchChange={(value) =>
                devtoolsState.filter({
                  ...devtoolsState.filter(),
                  search: value,
                })
              }
              onClearNodeFilter={() =>
                devtoolsState.filter({
                  ...devtoolsState.filter(),
                  nodeId: null,
                })
              }
              onHideInternalChange={(value) =>
                devtoolsState.filter({
                  ...devtoolsState.filter(),
                  hideInternal: value,
                })
              }
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <LogsTab />
          </div>
        </TabsContent>

        <TabsContent value="graph" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
          <GraphTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
