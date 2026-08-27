import { VideoSeenStatus } from '@video/shared';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds < 0) {
    return '—';
  }
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export function formatHours(seconds?: number | null): string {
  if (!seconds || seconds < 0) {
    return '0m';
  }
  if (seconds < 3600) {
    return `${Math.max(1, Math.round(seconds / 60))}m`;
  }
  const hours = seconds / 3600;
  const rounded = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
  return `${rounded}h`;
}

export function sumDurations(items: Array<{ duration?: number | null }>): number {
  return items.reduce((total, item) => {
    const value = item.duration;
    return total + (typeof value === 'number' && value > 0 ? value : 0);
  }, 0);
}

export function quizDurationSeconds(
  questions?: Array<{ duration?: number | null }> | null,
): number {
  return (questions ?? []).reduce((sum, question) => {
    return sum + (typeof question.duration === 'number' && question.duration > 0 ? question.duration : 30);
  }, 0);
}

export function durationsByModuleId(
  videos: Array<{ moduleId: string | null; duration?: number | null }>,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const video of videos) {
    if (!video.moduleId) {
      continue;
    }
    const duration = typeof video.duration === 'number' && video.duration > 0 ? video.duration : 0;
    totals.set(video.moduleId, (totals.get(video.moduleId) ?? 0) + duration);
  }
  return totals;
}

export type SeenProgress = {
  total: number;
  completed: number;
  pending: number;
  completedPercent: number;
  pendingPercent: number;
};

export const emptySeenProgress: SeenProgress = {
  total: 0,
  completed: 0,
  pending: 0,
  completedPercent: 0,
  pendingPercent: 0,
};

export function seenProgressFromCompletedPercent(
  items: Array<{ duration?: number | null; completedPercent?: number | null }>,
): SeenProgress {
  const total = sumDurations(items);
  if (total <= 0) {
    return emptySeenProgress;
  }
  const completed = items.reduce((sum, item) => {
    const duration = typeof item.duration === 'number' && item.duration > 0 ? item.duration : 0;
    const percent =
      typeof item.completedPercent === 'number' && Number.isFinite(item.completedPercent)
        ? Math.min(100, Math.max(0, item.completedPercent))
        : 0;
    return sum + (duration * percent) / 100;
  }, 0);
  const completedPercent = Math.round((completed / total) * 100);
  return {
    total,
    completed,
    pending: total - completed,
    completedPercent,
    pendingPercent: 100 - completedPercent,
  };
}

export function seenProgress(
  videos: Array<{ seenStatus?: string | null; duration?: number | null }>,
): SeenProgress {
  const total = sumDurations(videos);
  if (total <= 0) {
    return emptySeenProgress;
  }
  const completed = sumDurations(
    videos.filter((video) => video.seenStatus === VideoSeenStatus.COMPLETED),
  );
  const completedPercent = Math.round((completed / total) * 100);
  return {
    total,
    completed,
    pending: total - completed,
    completedPercent,
    pendingPercent: 100 - completedPercent,
  };
}

export function seenProgressByModuleId(
  videos: Array<{
    moduleId: string | null;
    seenStatus?: string | null;
    duration?: number | null;
  }>,
): Map<string, SeenProgress> {
  const grouped = new Map<
    string,
    Array<{ seenStatus?: string | null; duration?: number | null }>
  >();
  for (const video of videos) {
    if (!video.moduleId) {
      continue;
    }
    const list = grouped.get(video.moduleId) ?? [];
    list.push(video);
    grouped.set(video.moduleId, list);
  }
  const totals = new Map<string, SeenProgress>();
  for (const [moduleId, list] of grouped) {
    totals.set(moduleId, seenProgress(list));
  }
  return totals;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
