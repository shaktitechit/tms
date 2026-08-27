import Link from 'next/link';
import type { VideoDto } from '@/lib/types';
import { formatDate, formatDuration } from '@/lib/format';
import { SeenStatusBadge } from './SeenStatusBadge';
import { StatusBadge } from './StatusBadge';

export function VideoCard({
  video,
  href,
}: {
  video: VideoDto;
  href?: string;
}) {
  const link = href ?? `/videos/${video.slug || video.id}`;

  return (
    <Link
      href={link}
      className="group overflow-hidden rounded-2xl border border-blue-100 bg-white transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow"
    >
      <div className="relative aspect-video bg-blue-50">
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">No thumbnail</div>
        )}
        <span className="absolute left-2 top-2">
          <SeenStatusBadge status={video.seenStatus} />
        </span>
        <span className="absolute bottom-2 right-2 rounded bg-slate-900/80 px-1.5 py-0.5 text-xs text-white">
          {formatDuration(video.duration)}
        </span>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 font-medium leading-snug text-slate-900 group-hover:text-accent">{video.title}</h3>
          <StatusBadge status={video.status} />
        </div>
        <p className="text-xs text-slate-500">
          {formatDuration(video.duration)} · {formatDate(video.createdAt)}
        </p>
      </div>
    </Link>
  );
}
