import { Badge } from '../../src/components/ui/badge';
import { X } from 'lucide-react';
import type { LogEntry } from './store/types';
import { getCategoryColors } from './store/eventTypeManager';

type TransactionDetailProps = {
  transaction: LogEntry;
  onClose?: () => void;
};

export function TransactionDetail({
  transaction,
  onClose,
}: TransactionDetailProps) {
  const colors = getCategoryColors(transaction.category);

  return (
    <div className="h-full flex flex-col relative">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded hover:bg-muted transition-colors z-10"
          aria-label="Close detail view"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="h-full overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            Event Details
            <Badge variant="outline" className={`text-xs ${colors.main}`}>
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
    </div>
  );
}
