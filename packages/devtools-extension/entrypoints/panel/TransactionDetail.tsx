import { Badge } from '../../src/components/ui/badge';
import type {
  LogEntry,
  ResourceEventData,
} from './store/types';
import { ArrowRight } from 'lucide-react';

interface TransactionDetailProps {
  transaction: LogEntry;
}

export function TransactionDetail({ transaction }: TransactionDetailProps) {
  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 space-y-4">
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
                const data = transaction.data as ResourceEventData;
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
                    {'executionContext' in data && data.executionContext && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Read by:</span>
                        <span className="font-mono">
                          {data.executionContext as string}
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}

            {transaction.eventType === 'SIGNAL_WRITE' &&
              (() => {
                const data = transaction.data as ResourceEventData;
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
            <code>{JSON.stringify(transaction.data, null, 2)}</code>
          </pre>
        </div>
    </div>
  );
}
