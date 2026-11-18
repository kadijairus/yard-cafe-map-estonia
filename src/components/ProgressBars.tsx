interface ProgressRowProps {
  label: string;
  visited: number;
  total: number;
  fillColor: string;
}

function ProgressRow({label, visited, total, fillColor}: ProgressRowProps) {
  const ratio = total > 0 ? Math.min(1, visited / total) : 0;
  const percent = Math.round(ratio * 100);

  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[74px] shrink-0 text-xs font-semibold text-slate-900">
        {label}
      </span>
      <svg
        className="h-2.5 flex-1 overflow-hidden rounded-full"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={visited}
      >
        <rect x="0" y="0" width="100" height="10" rx="5" fill="#E2E8F0" />
        {percent > 0 && (
          <rect x="0" y="0" width={percent} height="10" rx="5" fill={fillColor} />
        )}
      </svg>
      <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-slate-900">
        {visited}/{total}
      </span>
    </div>
  );
}

interface ProgressBarsProps {
  cafesVisited: number;
  cafesTotal: number;
  eventsVisited: number;
  eventsTotal: number;
}

export function ProgressBars({
  cafesVisited,
  cafesTotal,
  eventsVisited,
  eventsTotal,
}: ProgressBarsProps) {
  return (
    <section
      aria-label="Külastuste edenemine"
      className="pointer-events-auto w-full rounded-2xl border border-slate-200/90 bg-white/95 px-3.5 py-2 shadow-md backdrop-blur-sm"
    >
      <div className="space-y-1.5">
        <ProgressRow
          label="Kohvikud"
          visited={cafesVisited}
          total={cafesTotal}
          fillColor="#FE5855"
        />
        <ProgressRow
          label="Tegevused"
          visited={eventsVisited}
          total={eventsTotal}
          fillColor="#980401"
        />
      </div>
    </section>
  );
}
