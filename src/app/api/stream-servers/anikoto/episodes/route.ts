import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const anikotoId = searchParams.get('anikotoId');
  const language = searchParams.get('language') || 'sub';
  const malId = searchParams.get('malId'); // optional fallback
  const totalEpisodes = parseInt(searchParams.get('totalEpisodes') || '0');

  // If we have malId but no anikotoId, use MAL endpoint directly
  if (!anikotoId && malId) {
    const epCount = totalEpisodes > 0 ? totalEpisodes : 12;
    const episodes = [];
    for (let i = 1; i <= epCount; i++) {
      episodes.push({
        number: i,
        title: `Episode ${i}`,
        link: `https://megaplay.buzz/stream/mal/${malId}/${i}/${language}`
      });
    }
    return NextResponse.json({ episodes });
  }

  if (!anikotoId) {
    return NextResponse.json({ error: 'anikotoId or malId required' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://anikotoapi.site/series/${anikotoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const animeData = data.data;
    const episodes = animeData?.episodes || [];

    // Get anime metadata for fallback
    const animeMeta = animeData?.anime || {};
    const fallbackMalId = malId || animeMeta.mal_id;

    const formattedEpisodes = episodes.map((ep: any) => {
      // 1. Try embed_url for requested language
      let link = ep.embed_url?.[language] || ep.embed_url?.sub || null;

      // 2. If not, construct using episode_embed_id
      if (!link && ep.episode_embed_id) {
        link = `https://megaplay.buzz/stream/s-2/${ep.episode_embed_id}/${language}`;
      }

      // 3. If still missing and we have malId, fallback to MAL endpoint
      if (!link && fallbackMalId) {
        link = `https://megaplay.buzz/stream/mal/${fallbackMalId}/${ep.number}/${language}`;
      }

      // 4. Last resort: use AniList endpoint (if we can get ani_id from metadata)
      if (!link && animeMeta.ani_id) {
        link = `https://megaplay.buzz/stream/ani/${animeMeta.ani_id}/${ep.number}/${language}`;
      }

      return {
        number: ep.number,
        title: ep.title || `Episode ${ep.number}`,
        link: link || `https://megaplay.buzz/stream/mal/${fallbackMalId || '0'}/${ep.number}/${language}`
      };
    });

    return NextResponse.json({ 
      episodes: formattedEpisodes,
      anime: animeMeta,
      fallbackMalId
    });

  } catch (error: any) {
    console.error('Anikoto episodes error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch episodes' }, { status: 500 });
  }
}