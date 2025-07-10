import { useEffect } from 'react';
import {
  devtoolsStore,
  handleDevToolsMessage,
  filteredTransactions,
  stats,
  dependencyGraphData,
  nodeDependencies,
  type DevToolsMessage,
  type SignalReadData,
  type SignalWriteData,
  type DependencyUpdateData,
  type GraphSnapshotData,
} from './store';
import { useSignal } from './useLattice';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../src/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../src/components/ui/select';
import { Input } from '../../src/components/ui/input';
import { Badge } from '../../src/components/ui/badge';
import { Button } from '../../src/components/ui/button';
import { Activity, Code2, Eye, EyeOff, GitBranch } from 'lucide-react';

export function App() {
  console.log('[DevTools Panel] App component rendering');

  // Use Lattice signals with React
  const connected = useSignal(devtoolsStore.state.connected);
  const contexts = useSignal(devtoolsStore.state.contexts);
  const selectedTab = useSignal(devtoolsStore.state.selectedTab);
  const transactions = useSignal(filteredTransactions);
  const statsData = useSignal(stats);
  const filter = useSignal(devtoolsStore.state.filter);
  const graphData = useSignal(dependencyGraphData);
  const getDependencies = useSignal(nodeDependencies);

  console.log('[DevTools Panel] Connected state:', connected);

  useEffect(() => {
    let port: chrome.runtime.Port | null = null;
    let timeoutId: number | null = null;

    // Connect to background script
    try {
      console.log('[DevTools Panel] Connecting to background script');
      port = chrome.runtime.connect({ name: 'devtools-panel' });

      // Send initialization message
      port.postMessage({
        type: 'INIT',
        tabId: chrome.devtools.inspectedWindow.tabId,
      });

      // Listen for messages from background script
      port.onMessage.addListener((message: DevToolsMessage) => {
        console.log(
          '[DevTools Panel] Received message from background:',
          message
        );
        handleDevToolsMessage(message);
      });

      port.onDisconnect.addListener(() => {
        console.log('[DevTools Panel] Disconnected from background script');
        devtoolsStore.state.connected.value = false;
      });

      // Request initial state
      timeoutId = window.setTimeout(() => {
        console.log('[DevTools Panel] Requesting initial state');
        port?.postMessage({
          type: 'GET_STATE',
          tabId: chrome.devtools.inspectedWindow.tabId,
        });
      }, 100);
    } catch (error) {
      console.error('[DevTools Panel] Error connecting to background:', error);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      port?.disconnect();
    };
  }, []);

  if (!connected) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <Activity className="w-12 h-12 mx-auto text-muted-foreground animate-pulse" />
          <p className="text-lg text-muted-foreground">
            Waiting for Lattice...
          </p>
          <p className="text-sm text-muted-foreground">
            Make sure the page is using{' '}
            <code className="bg-muted px-1 py-0.5 rounded">
              @lattice/devtools
            </code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background text-foreground">
      <div className="border-b">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5" />
            <h1 className="font-semibold">Lattice DevTools</h1>
            <Badge variant="secondary" className="text-xs">
              {contexts.length} context{contexts.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="w-4 h-4" />
            <span>{statsData.totalSignals} signals</span>
            <span>•</span>
            <span>{statsData.totalComputeds} computed</span>
            <span>•</span>
            <span>{statsData.totalEffects} effects</span>
            <span>•</span>
            <GitBranch className="w-4 h-4" />
            <span>{statsData.totalNodes} nodes</span>
          </div>
        </div>
      </div>

      <Tabs
        value={selectedTab}
        onValueChange={(value) =>
          (devtoolsStore.state.selectedTab.value = value as 'timeline' | 'graph')
        }
      >
        <TabsList className="w-full rounded-none border-b h-auto p-0 justify-start">
          <TabsTrigger
            value="timeline"
            className="rounded-none data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            Timeline
          </TabsTrigger>
          <TabsTrigger
            value="graph"
            className="rounded-none data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            Dependency Graph
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="m-0">
          <div className="flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Select
                  value={filter.type}
                  onValueChange={(value) =>
                    devtoolsStore.set({
                      filter: { ...filter, type: value as any },
                    })
                  }
                >
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="signal">Signals</SelectItem>
                    <SelectItem value="computed">Computed</SelectItem>
                    <SelectItem value="effect">Effects</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="text"
                  placeholder="Search..."
                  className="w-[200px] h-8"
                  value={filter.search}
                  onChange={(e) =>
                    devtoolsStore.set({
                      filter: { ...filter, search: e.target.value },
                    })
                  }
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {transactions.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No transactions yet...
                </div>
              ) : (
                <div className="divide-y">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="px-4 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground font-mono">
                          {tx.timestamp
                            ? new Date(tx.timestamp).toLocaleTimeString(
                                'en-US',
                                {
                                  hour12: false,
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  fractionalSecondDigits: 3,
                                }
                              )
                            : 'N/A'}
                        </span>
                        <Badge
                          variant={
                            tx.type === 'signal'
                              ? 'default'
                              : tx.type === 'computed'
                                ? 'secondary'
                                : 'outline'
                          }
                          className="text-xs"
                        >
                          {tx.eventType}
                        </Badge>
                        <div className="flex-1 font-mono text-xs overflow-ellipsis overflow-hidden whitespace-nowrap">
                          {(() => {
                            switch (tx.eventType) {
                              case 'SIGNAL_READ': {
                                const data = tx.data as SignalReadData;
                                return (
                                  <>
                                    {data.name || data.id} →{' '}
                                    {JSON.stringify(data.value)}
                                    {data.internal && (
                                      <Badge
                                        variant="outline"
                                        className="ml-2 text-xs"
                                      >
                                        internal
                                      </Badge>
                                    )}
                                    {data.executionContext && (
                                      <Badge
                                        variant="outline"
                                        className="ml-2 text-xs"
                                      >
                                        {data.executionContext}
                                      </Badge>
                                    )}
                                  </>
                                );
                              }
                              case 'SIGNAL_WRITE': {
                                const data = tx.data as SignalWriteData;
                                return (
                                  <>
                                    {data.name || data.id}:{' '}
                                    {JSON.stringify(data.oldValue)} →{' '}
                                    {JSON.stringify(data.newValue)}
                                  </>
                                );
                              }
                              case 'SIGNAL_CREATED':
                              case 'COMPUTED_CREATED':
                              case 'EFFECT_CREATED': {
                                const data = tx.data as {
                                  name?: string;
                                  id: string;
                                };
                                return <>{data.name || data.id} created</>;
                              }
                              case 'DEPENDENCY_UPDATE': {
                                const data = tx.data as DependencyUpdateData;
                                return (
                                  <>
                                    {data.type} {data.id} - {data.trigger}
                                    {data.dependencies.length > 0 && (
                                      <Badge
                                        variant="outline"
                                        className="ml-2 text-xs"
                                      >
                                        {data.dependencies.length} deps
                                      </Badge>
                                    )}
                                    {data.subscribers.length > 0 && (
                                      <Badge
                                        variant="outline"
                                        className="ml-2 text-xs"
                                      >
                                        {data.subscribers.length} subs
                                      </Badge>
                                    )}
                                  </>
                                );
                              }
                              case 'GRAPH_SNAPSHOT': {
                                const data = tx.data as GraphSnapshotData;
                                return (
                                  <>
                                    Graph snapshot: {data.nodes.length} nodes,{' '}
                                    {data.edges.length} edges
                                  </>
                                );
                              }
                              default:
                                return <>{JSON.stringify(tx.data)}</>;
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="graph" className="m-0">
          <div className="flex flex-col h-[calc(100vh-8rem)]">
            <div className="p-4 border-b">
              <h3 className="text-sm font-medium mb-2">Dependency Graph</h3>
              <p className="text-xs text-muted-foreground">
                Shows the reactive dependency relationships between signals,
                computed values, and effects.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {(() => {
                if (graphData.nodes.length === 0) {
                  return (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No dependency data available yet...
                    </div>
                  );
                }
                return (
                  <div className="space-y-4">
                    {graphData.nodes.map((node) => {
                      const deps = getDependencies(node.id);
                      return (
                        <div
                          key={node.id}
                          className="border rounded-lg p-4 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                node.type === 'signal'
                                  ? 'default'
                                  : node.type === 'computed'
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {node.type}
                            </Badge>
                            <span className="font-mono text-sm">
                              {node.name || node.id}
                            </span>
                            {node.isActive && (
                              <Badge variant="outline" className="text-xs">
                                active
                              </Badge>
                            )}
                            {node.isOutdated && (
                              <Badge variant="destructive" className="text-xs">
                                outdated
                              </Badge>
                            )}
                          </div>
                          {node.value !== undefined && (
                            <div className="text-xs text-muted-foreground font-mono">
                              value: {JSON.stringify(node.value)}
                            </div>
                          )}
                          {deps.dependencies.length > 0 && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">
                                Dependencies:
                              </span>
                              <div className="ml-4 mt-1 space-y-1">
                                {deps.dependencies.map(({ id, node: dep }) => (
                                  <div key={id} className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {dep?.type || 'unknown'}
                                    </Badge>
                                    <span className="font-mono">
                                      {dep?.name || id}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {deps.subscribers.length > 0 && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">
                                Subscribers:
                              </span>
                              <div className="ml-4 mt-1 space-y-1">
                                {deps.subscribers.map(({ id, node: sub }) => (
                                  <div key={id} className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {sub?.type || 'unknown'}
                                    </Badge>
                                    <span className="font-mono">
                                      {sub?.name || id}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
