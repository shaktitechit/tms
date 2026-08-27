import { VideoSeenStatus } from '@video/shared';

const styles: Record<string, string> = {
  [VideoSeenStatus.PENDING]: 'bg-amber-50 text-amber-800',
  [VideoSeenStatus.COMPLETED]: 'bg-emerald-50 text-emerald-800',
};

const labels: Record<string, string> = {
  [VideoSeenStatus.PENDING]: 'Pending',
  [VideoSeenStatus.COMPLETED]: 'Completed',
};

export function SeenStatusBadge({ status }: { status?: string | null }) {
  const value = status === VideoSeenStatus.COMPLETED ? VideoSeenStatus.COMPLETED : VideoSeenStatus.PENDING;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium tracking-wide ${styles[value]}`}
    >
      {labels[value]}
    </span>
  );
}
