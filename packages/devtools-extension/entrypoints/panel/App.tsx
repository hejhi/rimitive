import { useSubscribe } from '@lattice/react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../src/components/ui/tabs';
import { LogsTab } from './LogsTab';
import {
  ConnectionStatus,
  DependencyGraphView,
  FilterBar,
  Header,
  TimelineView,
} from './components';
import {
  useDataExport,
  useDevToolsConnection,
  useIsNarrowViewport,
} from './hooks';
import { devtoolsState } from './store/devtoolsCtx';
import {
  dependencyGraphData,
  filteredTransactions,
  nodeDependencies,
  stats,
} from './store/computed';

export function App() {
  // Use Lattice signals with React
  const connected = useSubscribe(devtoolsState.connected);
  const contexts = useSubscribe(devtoolsState.contexts);
  const selectedTab = useSubscribe(devtoolsState.selectedTab);
  const selectedTransaction = useSubscribe(
    devtoolsState.selectedTransaction
  );
  const filter = useSubscribe(devtoolsState.filter);
  const transactions = useSubscribe(filteredTransactions);
  const statsData = useSubscribe(stats);
  const graphData = useSubscribe(dependencyGraphData);
  const getDependencies = useSubscribe(nodeDependencies);

  // Use custom hooks
  const isNarrowViewport = useIsNarrowViewport();
  const { handleExport, handleImport } = useDataExport();
  useDevToolsConnection();

  if (!connected) {
    return <ConnectionStatus />;
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <Header
        contextCount={contexts.length}
        stats={statsData}
        onExport={handleExport}
        onImport={handleImport}
      />

      <Tabs
        className="h-[calc(100vh-6rem)] flex flex-col grow"
        value={selectedTab}
        onValueChange={(value) =>
          (devtoolsState.selectedTab.value = value as
            | 'logs'
            | 'timeline'
            | 'graph')
        }
      >
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-b">
          <TabsList className="h-8">
            <TabsTrigger value="logs" className="text-xs">
              Logs
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs">
              Timeline
            </TabsTrigger>
            <TabsTrigger value="graph" className="text-xs">
              Dependencies
            </TabsTrigger>
          </TabsList>

          <FilterBar
            contexts={contexts}
            selectedContext={devtoolsState.selectedContext.value}
            filterType={filter.type}
            searchValue={filter.search}
            onContextChange={(value) =>
              (devtoolsState.selectedContext.value = value)
            }
            onFilterTypeChange={(value) =>
              (devtoolsState.filter.value = {
                ...devtoolsState.filter.value,
                type: value,
              })
            }
            onSearchChange={(value) =>
              (devtoolsState.filter.value = {
                ...devtoolsState.filter.value,
                search: value,
              })
            }
          />
        </div>

        <TabsContent value="logs" className="flex-1 overflow-hidden">
          <LogsTab />
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 overflow-hidden">
          <TimelineView
            transactions={transactions}
            selectedTransaction={selectedTransaction}
            isNarrowViewport={isNarrowViewport}
            onTransactionSelect={(id) =>
              (devtoolsState.selectedTransaction.value = id)
            }
          />
        </TabsContent>

        <TabsContent
          value="graph"
          className="m-0 flex flex-col flex-1 overflow-hidden"
        >
          <div className="p-4 border-b">
            <h3 className="text-sm font-medium mb-2">Dependency Graph</h3>
            <p className="text-xs text-muted-foreground">
              Shows the reactive dependency relationships between signals,
              computed values, and effects.
            </p>
          </div>
          <DependencyGraphView
            nodes={graphData.nodes}
            getDependencies={getDependencies}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
