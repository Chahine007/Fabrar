import React from 'react';
import { EmptyState } from './empty-state';

export function ResponsiveDataView<T>({
  data,
  getKey,
  renderCard,
  renderTable,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
}: {
  data: T[];
  getKey: (item: T) => React.Key;
  renderCard: (item: T) => React.ReactNode;
  renderTable: (items: T[]) => React.ReactNode;
  emptyTitle: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyIcon?: React.ElementType;
  emptyAction?: React.ReactNode;
}) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {data.map((item) => (
          <React.Fragment key={getKey(item)}>{renderCard(item)}</React.Fragment>
        ))}
      </div>
      <div className="hidden md:block">{renderTable(data)}</div>
    </>
  );
}
