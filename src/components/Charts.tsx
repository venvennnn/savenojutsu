"use client";

export function HorizontalBars({
  items,
}: {
  items: { label: string; count: number; pct: number }[];
}) {
  if (!items.length) {
    return <p className="text-sm text-muted">No chart — not enough classified text.</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_2fr_auto] items-center gap-2">
          <span className="truncate text-sm">{item.label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-forest"
              style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-24 text-right text-xs text-muted">
            {item.count} · {item.pct.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function MonthBars({
  months,
}: {
  months: { month: string; total: number }[];
}) {
  if (!months.length) {
    return <p className="text-sm text-muted">No save-date chart — dates were missing in the export.</p>;
  }
  const max = Math.max(1, ...months.map((m) => m.total));
  return (
    <div className="flex h-40 items-end gap-1">
      {months.map((m) => (
        <div key={m.month} className="flex flex-1 flex-col items-center justify-end">
          <div
            className="w-full max-w-8 rounded-t bg-leaf"
            style={{ height: `${(m.total / max) * 120}px` }}
            title={`${m.month}: ${m.total}`}
          />
          <span className="mt-1 origin-top-left scale-90 text-[10px] text-muted">
            {m.month.slice(2)}
          </span>
        </div>
      ))}
    </div>
  );
}
