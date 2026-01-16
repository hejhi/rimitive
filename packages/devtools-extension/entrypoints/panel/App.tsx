import { useSubscribe } from '@rimitive/react';
import { Trash2 } from 'lucide-react';
import { Button } from '../../src/components/ui/button';
import { LogsTab } from './LogsTab';
import { ConnectionStatus, FilterBar, Header } from './components';
import { useDataExport, useDevToolsConnection } from './hooks';
import { devtoolsState } from './store/devtoolsCtx';

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

      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-xs font-medium">Logs</span>
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
    </div>
  );
}
