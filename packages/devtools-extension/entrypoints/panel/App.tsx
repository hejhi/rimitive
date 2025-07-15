import { useSignal } from './useLattice';
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
import { devtoolsStore } from './store/devtoolsCtx';
import {
  dependencyGraphData,
  filteredTransactions,
  nodeDependencies,
  stats,
  filterType,
  filterSearch,
  contextCount,
} from './store/computed';

export function App() {
  console.log('[DevTools Panel] App component rendering');

  // Use Lattice signals with React - using fine-grained selectors
  const connected = useSignal(devtoolsStore.state.connected);
  const contexts = useSignal(devtoolsStore.state.contexts);
  const contextsCount = useSignal(contextCount);
  const selectedTab = useSignal(devtoolsStore.state.selectedTab);
  const selectedTransaction = useSignal(
    devtoolsStore.state.selectedTransaction
  );
  const transactions = useSignal(filteredTransactions);
  const statsData = useSignal(stats);
  const currentFilterType = useSignal(filterType);
  const searchValue = useSignal(filterSearch);
  const graphData = useSignal(dependencyGraphData);
  const getDependencies = useSignal(nodeDependencies);

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
        contextCount={contextsCount}
        stats={statsData}
        onExport={handleExport}
        onImport={handleImport}
      />

      <Tabs
        className="h-[calc(100vh-6rem)] flex flex-col grow"
        value={selectedTab}
        onValueChange={(value) =>
          (devtoolsStore.state.selectedTab.value = value as
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
            selectedContext={devtoolsStore.state.selectedContext.value}
            filterType={currentFilterType}
            searchValue={searchValue}
            onContextChange={(value) =>
              (devtoolsStore.state.selectedContext.value = value)
            }
            onFilterTypeChange={(value) =>
              (devtoolsStore.state.filter.value = {
                ...devtoolsStore.state.filter.value,
                type: value,
              })
            }
            onSearchChange={(value) =>
              (devtoolsStore.state.filter.value = {
                ...devtoolsStore.state.filter.value,
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
              (devtoolsStore.state.selectedTransaction.value = id)
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
