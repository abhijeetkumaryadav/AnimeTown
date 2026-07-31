import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Read the IDs as sent from the import function
  const imdbId = searchParams.get('imdbId');
  const tmdbId = searchParams.get('tmdbId');
  const totalEpisodes = parseInt(searchParams.get('totalEpisodes') || '0');
  const season = parseInt(searchParams.get('season') || '1');
  const type = searchParams.get('type') || 'TV';

  // Use whichever ID is available (TMDB preferred, fallback to IMDB)
  const id = tmdbId || imdbId;

  if (!id) {
    return NextResponse.json(
      { error: 'Either TMDB ID or IMDB ID is required' },
      { status: 400 }
    );
  }

  const mediaType = type.toLowerCase();

  // --- Movie ---
  if (mediaType === 'movie') {
    const link = imdbId
      ? `https://vaplayer.ru/embed/movie/${imdbId}`
      : `https://vaplayer.ru/embed/movie/${tmdbId}`;
    return NextResponse.json({
      episodes: [
        {
          number: 1,
          link: link
        }
      ]
    });
  }

  // --- TV Show ---
  const epCount = totalEpisodes > 0 ? totalEpisodes : 12;
  const episodes = [];
  for (let i = 1; i <= epCount; i++) {
    // Use IMDB ID if available, else TMDB ID
    const baseId = imdbId || tmdbId;
    const link = imdbId
      ? `https://vaplayer.ru/embed/tv/${imdbId}/${season}/${i}`
      : `https://vaplayer.ru/embed/tv/${tmdbId}/${season}/${i}`;
    episodes.push({
      number: i,
      link: link
    });
  }

  return NextResponse.json({ episodes, season });
}