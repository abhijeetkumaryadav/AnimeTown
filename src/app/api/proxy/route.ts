// app/api/proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime for streaming support (required on Vercel)
export const runtime = 'nodejs';

const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '::1'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (BLOCKED_HOSTS.some(host => url.hostname.includes(host))) {
    return NextResponse.json({ error: 'Forbidden host' }, { status: 403 });
  }
  if (url.pathname.startsWith('/api/proxy')) {
    return NextResponse.json({ error: 'Recursive proxy not allowed' }, { status: 403 });
  }

  // ---------- Build headers for the upstream request ----------
  const upstreamHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Impersonate the target’s own origin to bypass hotlink protection
    'Origin': url.origin,
    'Referer': url.origin + '/',
    'Accept': '*/*',
  };

  // Forward client's Range header for partial content
  const clientRange = request.headers.get('range');
  if (clientRange) {
    upstreamHeaders['Range'] = clientRange;
  }

  try {
    const response = await fetch(targetUrl, {
      headers: upstreamHeaders,
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') || '';
    const isPlaylist =
      contentType.includes('application/vnd.apple.mpegurl') ||
      contentType.includes('application/x-mpegurl') ||
      targetUrl.toLowerCase().includes('.m3u8');

    // ---------- Handle .m3u8 playlists ----------
    if (isPlaylist) {
      const text = await response.text();
      const baseUrl = new URL(targetUrl);

      // Rewrite all resource URLs (relative & absolute) to use the proxy
      const rewritten = text
        .split(/\r?\n/)
        .map(line => {
          const trimmed = line.trim();
          if (
            !trimmed ||
            trimmed.startsWith('#') ||
            trimmed.includes('/api/proxy?url=') // already rewritten
          ) {
            return line;
          }
          // Resolve relative URLs against the base URL of the playlist
          try {
            const resolved = new URL(trimmed, baseUrl).toString();
            return `/api/proxy?url=${encodeURIComponent(resolved)}`;
          } catch {
            return line; // keep original if it can't be parsed
          }
        });

      return new NextResponse(rewritten.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // ---------- Handle binary segments (ts, m4s, etc.) ----------
    const resHeaders = new Headers();
    resHeaders.set('Access-Control-Allow-Origin', '*');
    resHeaders.set('Content-Type', contentType || 'application/octet-stream');

    // Forward Content-Length (critical for HLS)
    const contentLength = response.headers.get('content-length');
    if (contentLength) resHeaders.set('Content-Length', contentLength);

    // Forward Range-related headers
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges');
    if (contentRange) resHeaders.set('Content-Range', contentRange);
    if (acceptRanges) resHeaders.set('Accept-Ranges', acceptRanges);

    // Preserve the upstream status (206 for partial content, 200 for full)
    const status = response.status;

    // Stream the body back
    return new NextResponse(response.body, { status, headers: resHeaders });
  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
    },
  });
}