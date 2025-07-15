import { Badge } from '../../../src/components/ui/badge';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '../../../src/components/ui/resizable';
import { TransactionDetail } from '../TransactionDetail';
import type { Transaction } from '../store/types';

interface TimelineViewProps {
  transactions: Transaction[];
  selectedTransaction: string | null;
  isNarrowViewport: boolean;
  onTransactionSelect: (id: string | null) => void;
}

export function TimelineView({
  transactions,
  selectedTransaction,
  isNarrowViewport,
  onTransactionSelect,
}: TimelineViewProps) {
  const transaction = transactions.find((t) => t.id === selectedTransaction);

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
              <TransactionDetail transaction={transaction} />
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}

interface TransactionItemProps {
  transaction: Transaction;
  isSelected: boolean;
  onSelect: () => void;
}

function TransactionItem({
  transaction,
  isSelected,
  onSelect,
}: TransactionItemProps) {
  const tx = transaction;

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
            const data = tx.data;
            if ('name' in data && data.name) return data.name;
            if ('id' in data && data.id) return data.id;
            return tx.eventType;
          })()}
        </div>
      </div>
    </div>
  );
}
