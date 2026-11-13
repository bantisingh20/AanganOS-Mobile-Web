export interface Slice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ slices, centerLabel, size = 160 }: { slices: Slice[]; centerLabel?: string; size?: number }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
          {total > 0
            ? slices.map((s) => {
                const len = (s.value / total) * circumference;
                const dash = `${len} ${circumference - len}`;
                const el = (
                  <circle
                    key={s.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={stroke}
                    strokeDasharray={dash}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return el;
              })
            : null}
        </g>
        <text x="50%" y="46%" textAnchor="middle" className="fill-foreground text-2xl font-extrabold">{total}</text>
        {centerLabel ? <text x="50%" y="60%" textAnchor="middle" className="fill-muted-foreground text-xs">{centerLabel}</text> : null}
      </svg>
      <ul className="flex w-full flex-col gap-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="flex-1 text-muted-foreground">{s.label}</span>
            <span className="font-semibold">{s.value}</span>
            <span className="w-10 text-right text-xs text-muted-foreground">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface Bar {
  label: string;
  value: number;
  color: string;
}

export function BarChart({ bars, height = 180 }: { bars: Bar[]; height?: number }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
      {bars.map((b) => (
        <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-xs font-semibold">{b.value}</span>
          <div
            className="w-full rounded-t-md transition-all"
            style={{ height: `${Math.max(4, (b.value / max) * (height - 44))}px`, backgroundColor: b.color }}
          />
          <span className="w-full truncate text-center text-[10px] text-muted-foreground" title={b.label}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}
