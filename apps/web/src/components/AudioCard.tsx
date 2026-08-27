import Link from 'next/link';
import type { AudioDto } from '@/lib/types';
import { formatDate, formatDuration } from '@/lib/format';
import { SeenStatusBadge } from './SeenStatusBadge';
import { StatusBadge } from './StatusBadge';

export function AudioCard({
  audio,
  href,
}: {
  audio: AudioDto;
  href?: string;
}) {
  const link = href ?? `/audios/${audio.slug || audio.id}`;

  return (
    <Link
      href={link}
      className="group overflow-hidden rounded-2xl border border-blue-100 bg-white transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow"
    >
      <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-sm font-semibold text-accent shadow-sm">
          Audio
        </div>
        <span className="absolute left-2 top-2">
          <SeenStatusBadge status={audio.seenStatus} />
        </span>
        <span className="absolute bottom-2 right-2 rounded bg-slate-900/80 px-1.5 py-0.5 text-xs text-white">
          {formatDuration(audio.duration)}
        </span>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 font-medium leading-snug text-slate-900 group-hover:text-accent">
            {audio.title}
          </h3>
          <StatusBadge status={audio.status} />
        </div>
        <p className="text-xs text-slate-500">
          {formatDuration(audio.duration)} · {formatDate(audio.createdAt)}
          {audio.lessonName ? ` · ${audio.lessonName}` : ''}
        </p>
      </div>
    </Link>
  );
}
