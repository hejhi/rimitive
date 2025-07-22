import { Badge } from '../../../src/components/ui/badge';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '../../../src/components/ui/resizable';
import { TransactionDetail } from '../TransactionDetail';
import type { LogEntry } from '../store/types';
import { getCategoryColors } from '../store/eventTypeManager';
import { useIsNarrowViewport } from '../hooks';

interface TimelineViewProps {
  transactions: LogEntry[];
  selectedTransaction: string | null;
  onTransactionSelect: (id: string | null) => void;
}

export function TimelineView({
  transactions,
  selectedTransaction,
  onTransactionSelect,
}: TimelineViewProps) {
  const transaction = transactions.find((t) => t.id === selectedTransaction);
  const isNarrowViewport = useIsNarrowViewport();

  if (transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No transactions yet...
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      direction={isNarrowViewport ? 'vertical' : 'horizontal'}
      className="h-full"
    >
      <ResizablePanel
        defaultSize={transaction ? (isNarrowViewport ? 70 : 60) : 100}
        minSize={30}
      >
        <div className="divide-y h-full overflow-y-auto">
          {transactions.map((tx) => (
            <TransactionItem
              key={tx.id}
              transaction={tx}
              isSelected={selectedTransaction === tx.id}
              onSelect={() =>
                onTransactionSelect(
                  selectedTransaction === tx.id ? null : tx.id
                )
              }
            />
          ))}
        </div>
      </ResizablePanel>
      {transaction && (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={isNarrowViewport ? 30 : 40} minSize={20}>
            <div className="h-full overflow-hidden bg-muted/20">
              <TransactionDetail 
                transaction={transaction} 
                onClose={() => onTransactionSelect(null)}
              />
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}

interface TransactionItemProps {
  transaction: LogEntry;
  isSelected: boolean;
  onSelect: () => void;
}

function TransactionItem({
  transaction,
  isSelected,
  onSelect,
}: TransactionItemProps) {
  const tx = transaction;
  const colors = getCategoryColors(tx.category);

  return (
    <div
      className={`px-4 py-2 hover:bg-muted/50 transition-colors cursor-pointer ${
        isSelected ? 'bg-muted' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground font-mono">
          {tx.timestamp
            ? new Date(tx.timestamp).toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3,
              })
            : 'N/A'}
        </span>
        <Badge
          variant="outline"
          className={`text-xs ${colors.main}`}
        >
          {tx.eventType}
        </Badge>
        <div className="flex-1 font-mono text-xs overflow-ellipsis overflow-hidden whitespace-nowrap">
          {tx.nodeName || tx.nodeId}
        </div>
      </div>
    </div>
  );
}
