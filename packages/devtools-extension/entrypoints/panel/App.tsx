import { useSubscribe } from '@rimitive/react';
import { Trash2 } from 'lucide-react';
import { Button } from '../../src/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../src/components/ui/tabs';
import { LogsTab } from './LogsTab';
import {
  ConnectionStatus,
  FilterBar,
  Header,
  TimelineView,
} from './components';
import { useDataExport, useDevToolsConnection } from './hooks';
import { devtoolsState } from './store/devtoolsCtx';
import { filteredTransactions } from './store/computed';

export function App() {
  // Use Rimitive signals with React
  const connected = useSubscribe(devtoolsState.connected);
  const contexts = useSubscribe(devtoolsState.contexts);
  const selectedTab = useSubscribe(devtoolsState.selectedTab);
  const selectedTransaction = useSubscribe(devtoolsState.selectedTransaction);
  const filter = useSubscribe(devtoolsState.filter);
  const transactions = useSubscribe(filteredTransactions);

  // Use custom hooks
  const { handleExport, handleImport } = useDataExport();
  useDevToolsConnection();

  if (!connected) {
    return <ConnectionStatus />;
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <Header
        contextCount={contexts.length}
        onExport={handleExport}
        onImport={handleImport}
      />

      <Tabs
        className="h-[calc(100vh-6rem)] flex flex-col grow"
        value={selectedTab}
        onValueChange={(value) =>
          devtoolsState.selectedTab(value as 'logs' | 'timeline')
        }
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <TabsList className="h-8">
            <TabsTrigger value="logs" className="text-xs">
              Logs
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs">
              Timeline
            </TabsTrigger>
          </TabsList>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              devtoolsState.logEntries([]);
              devtoolsState.selectedTransaction(null);
            }}
            title="Clear all events"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b">
          <FilterBar
            contexts={contexts}
            selectedContext={devtoolsState.selectedContext()}
            filterType={filter.type}
            searchValue={filter.search}
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
          />
        </div>

        <TabsContent value="logs" className="flex-1 overflow-hidden">
          <LogsTab />
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 overflow-hidden">
          <TimelineView
            transactions={transactions}
            selectedTransaction={selectedTransaction}
            onTransactionSelect={(id) => devtoolsState.selectedTransaction(id)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
