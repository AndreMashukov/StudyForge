const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
]);

/**
 * Returns true if the supplied URL is a YouTube URL we can attempt transcript
 * extraction on. Uses URL parsing rather than a single fragile regex.
 */
export function isYouTubeUrl(raw: string): boolean {
  return extractVideoId(raw) !== null;
}

/**
 * Extract the 11-character YouTube video ID from a URL.
 * Supports:
 *  - youtube.com/watch?v=<id>
 *  - youtube.com/embed/<id>
 *  - youtube.com/v/<id>
 *  - youtube.com/shorts/<id>
 *  - youtu.be/<id>
 *
 * Returns null if the URL is not a recognized YouTube format or if the
 * extracted ID does not match the expected format.
 */
export function extractVideoId(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) {
    return null;
  }

  let videoId: string | null = null;

  if (host === 'youtu.be') {
    // youtu.be/<id>
    videoId = parsed.pathname.slice(1).split('?')[0];
  } else {
    // youtube.com paths
    const path = parsed.pathname;

    if (path.startsWith('/watch')) {
      videoId = parsed.searchParams.get('v');
    } else if (
      path.startsWith('/embed/') ||
      path.startsWith('/v/') ||
      path.startsWith('/shorts/')
    ) {
      const segments = path.split('/').filter(Boolean);
      // index 0 is 'embed', 'v', or 'shorts'; index 1 is the ID
      videoId = segments[1] ?? null;
    }
  }

  if (!videoId || !VIDEO_ID_REGEX.test(videoId)) {
    return null;
  }

  return videoId;
}
