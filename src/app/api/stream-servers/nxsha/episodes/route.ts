import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tmdbId = searchParams.get('anilistId'); // parameter reused
  const totalEpisodes = parseInt(searchParams.get('totalEpisodes') || '0');
  const season = parseInt(searchParams.get('season') || '1');
  const type = searchParams.get('type') || 'tv';

  if (!tmdbId) {
    return NextResponse.json({ error: 'TMDb ID required' }, { status: 400 });
  }

  // For movies, return a single "episode"
  if (type === 'movie') {
    return NextResponse.json({
      episodes: [
        {
          number: 1,
          link: `https://web.nxsha.app/embed/movie/${tmdbId}`
        }
      ]
    });
  }

  // For TV shows, generate episodes
  const epCount = totalEpisodes > 0 ? totalEpisodes : 12;
  const episodes = [];
  for (let i = 1; i <= epCount; i++) {
    episodes.push({
      number: i,
      link: `https://web.nxsha.app/embed/tv/${tmdbId}/${season}/${i}`
    });
  }

  return NextResponse.json({ episodes, season });
}