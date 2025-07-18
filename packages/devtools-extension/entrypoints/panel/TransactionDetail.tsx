import { Badge } from '../../src/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../src/components/ui/tabs';
import type {
  LogEntry,
  SignalReadData,
  SignalWriteData,
} from './store/types';
import { useSignal } from './useLattice';
import { ArrowRight } from 'lucide-react';
import { NodeDependencyView } from './NodeDependencyView';
import { dependencyGraphData, nodeDependencies } from './store/computed';

interface TransactionDetailProps {
  transaction: LogEntry;
}

export function TransactionDetail({ transaction }: TransactionDetailProps) {
  const graphData = useSignal(dependencyGraphData);
  const getDependencies = useSignal(nodeDependencies);

  // Extract the relevant node ID from the transaction
  const getNodeId = (): string | null => {
    return transaction.nodeId;
  };

  const nodeId = getNodeId();
  const node = nodeId ? graphData.nodes.find((n) => n.id === nodeId) : null;
  const deps = nodeId ? getDependencies(nodeId) : null;

  return (
    <Tabs defaultValue="details" className="h-full flex flex-col">
      <TabsList className="m-4 mb-0">
        <TabsTrigger className="text-xs" value="details">
          Details
        </TabsTrigger>
        {node && (
          <TabsTrigger className="text-xs" value="dependencies">
            Dependencies
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent
        value="details"
        className="flex-1 overflow-y-auto p-4 pt-2 space-y-4"
      >
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            Event Details
            <Badge
              variant={
                transaction.category === 'signal'
                  ? 'default'
                  : transaction.category === 'computed'
                    ? 'secondary'
                    : 'outline'
              }
              className="text-xs"
            >
              {transaction.eventType === 'COMPUTED_END'
                ? 'COMPUTED'
                : transaction.eventType === 'EFFECT_END'
                  ? 'EFFECT'
                  : transaction.eventType}
            </Badge>
          </h3>

          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Time:</span>
              <span className="font-mono">
                {new Date(transaction.timestamp).toLocaleTimeString('en-US', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  fractionalSecondDigits: 3,
                })}
              </span>
            </div>

            {transaction.eventType === 'SIGNAL_READ' &&
              (() => {
                const data = transaction.rawData as SignalReadData;
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Signal:</span>
                      <span className="font-mono">{transaction.nodeName || transaction.nodeId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Value:</span>
                      <span className="font-mono">
                        {JSON.stringify(data.value)}
                      </span>
                    </div>
                    {data.executionContext && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Read by:</span>
                        <span className="font-mono">
                          {data.executionContext}
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}

            {transaction.eventType === 'SIGNAL_WRITE' &&
              (() => {
                const data = transaction.rawData as SignalWriteData;
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Signal:</span>
                      <span className="font-mono">{transaction.nodeName || transaction.nodeId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Change:</span>
                      <span className="font-mono">
                        {JSON.stringify(data.oldValue)}{' '}
                        <ArrowRight className="inline w-3 h-3" />{' '}
                        {JSON.stringify(data.newValue)}
                      </span>
                    </div>
                  </>
                );
              })()}
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold mb-2">Raw Event Data</h3>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
            <code>{JSON.stringify(transaction.rawData, null, 2)}</code>
          </pre>
        </div>
      </TabsContent>

      {node && deps && (
        <TabsContent
          value="dependencies"
          className="flex-1 overflow-y-auto p-4 pt-2"
        >
          <NodeDependencyView
            node={node}
            dependencies={deps.dependencies}
            subscribers={deps.subscribers}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
