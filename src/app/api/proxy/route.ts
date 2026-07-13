// app/api/proxy/route.ts (App Router)
import { NextRequest, NextResponse } from 'next/server';

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

  try {
    // Forward the client's Range header if present
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (compatible; NextJS-Proxy/1.0)',
    };
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const response = await fetch(targetUrl, { headers });

    // ---------- Handle .m3u8 playlist ----------
    const contentType = response.headers.get('content-type') || '';
    const isPlaylist =
      contentType.includes('application/vnd.apple.mpegurl') ||
      contentType.includes('text/plain') ||
      targetUrl.includes('.m3u8');

    if (isPlaylist) {
      const text = await response.text();
      const baseUrl = new URL(targetUrl);

      const rewritten = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.includes('/api/proxy?url=')) {
          return line;
        }
        try {
          const resolvedUrl = new URL(trimmed, baseUrl).toString();
          return `/api/proxy?url=${encodeURIComponent(resolvedUrl)}`;
        } catch {
          return line;
        }
      });

      return new NextResponse(rewritten.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': contentType || 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // ---------- Binary segment (ts, m4s, etc.) ----------
    const resHeaders = new Headers();
    resHeaders.set('Access-Control-Allow-Origin', '*');
    resHeaders.set('Content-Type', contentType || 'application/octet-stream');

    // Forward Content-Range and Accept-Ranges if present
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges');

    if (contentRange) resHeaders.set('Content-Range', contentRange);
    if (acceptRanges) resHeaders.set('Accept-Ranges', acceptRanges);
    else resHeaders.set('Accept-Ranges', 'bytes'); // default

    // If the upstream responded with 206, we also send 206
    const status = response.status === 206 ? 206 : response.status;

    // Stream the body
    return new NextResponse(response.body, {
      status,
      headers: resHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Handle CORS preflight (especially for range requests)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type', // allow Range header
    },
  });
}