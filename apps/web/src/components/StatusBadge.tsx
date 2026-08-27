import { VideoStatus } from '@video/shared';

const styles: Record<string, string> = {
  [VideoStatus.UPLOADING]: 'bg-slate-100 text-slate-700',
  [VideoStatus.UPLOADED]: 'bg-sky-50 text-sky-700',
  [VideoStatus.QUEUED]: 'bg-amber-50 text-amber-700',
  [VideoStatus.PROCESSING]: 'bg-blue-50 text-blue-700',
  [VideoStatus.READY]: 'bg-emerald-50 text-emerald-700',
  [VideoStatus.FAILED]: 'bg-rose-50 text-rose-700',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
        styles[status] ?? 'bg-slate-100 text-slate-600'
      }`}
    >
      {status}
    </span>
  );
}
