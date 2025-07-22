import { Badge } from '../../src/components/ui/badge';
import type {
  LogEntry,
} from './store/types';

interface TransactionDetailProps {
  transaction: LogEntry;
}

export function TransactionDetail({ transaction }: TransactionDetailProps) {
  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            Event Details
            <Badge variant="outline" className="text-xs">
              {transaction.eventType}
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

            {transaction.nodeName && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-mono">{transaction.nodeName}</span>
              </div>
            )}

            {transaction.nodeId && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono">{transaction.nodeId}</span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold mb-2">Event Data</h3>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
            <code>{JSON.stringify(transaction.data, null, 2)}</code>
          </pre>
        </div>
    </div>
  );
}
