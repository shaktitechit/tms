const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

function isYoutubeId(value?: string | null): boolean {
  return Boolean(value && YOUTUBE_ID.test(value));
}

/** Extract an 11-character YouTube video id from a URL or bare id. */
export function parseYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  if (isYoutubeId(trimmed)) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) {
    return null;
  }

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && isYoutubeId(id) ? id : null;
  }

  const fromQuery = url.searchParams.get('v');
  if (isYoutubeId(fromQuery)) {
    return fromQuery;
  }

  const parts = url.pathname.split('/').filter(Boolean);
  const nestedId = parts[1];
  const kind = parts[0];
  if (nestedId && kind && ['embed', 'shorts', 'live', 'v'].includes(kind)) {
    return isYoutubeId(nestedId) ? nestedId : null;
  }

  return null;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function isYoutubePlaybackUrl(src: string): boolean {
  return src.includes('youtube.com/embed/') || src.includes('youtube-nocookie.com/embed/');
}
