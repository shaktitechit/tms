import type { SeenProgress } from '@/lib/format';

export function SeenProgressSummary({
  progress,
  className = '',
}: {
  progress: SeenProgress;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`.trim()}>
      <p className="text-sm text-slate-500">
        <span className="font-medium text-emerald-700">{progress.completedPercent}% completed</span>
        <span className="mx-1.5 text-slate-300">·</span>
        <span className="font-medium text-amber-700">{progress.pendingPercent}% pending</span>
      </p>
      <div
        className={`h-1.5 w-full overflow-hidden rounded-full ${
          progress.total === 0 ? 'bg-slate-100' : 'bg-amber-100'
        }`}
      >
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${progress.completedPercent}%` }}
        />
      </div>
    </div>
  );
}
