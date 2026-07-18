import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('search') || '';

  if (!query) {
    return NextResponse.json({ error: 'Search query required' }, { status: 400 });
  }

  try {
    // Step 1: Fetch all recent anime pages (up to 5 pages, 50 per page)
    const allItems: any[] = [];
    for (let page = 1; page <= 5; page++) {
      try {
        const res = await fetch(`https://anikotoapi.site/recent-anime?page=${page}&per_page=50`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) continue;
        const data = await res.json();
        const items = data.data || [];
        allItems.push(...items);
        if (items.length === 0) break; // no more items
      } catch {}
    }

    // Step 2: Filter by title (case‑insensitive)
    const matchedByTitle = allItems.filter((item: any) =>
      item.title?.toLowerCase().includes(query.toLowerCase()) ||
      item.alternative?.toLowerCase().includes(query.toLowerCase()) ||
      item.slug?.toLowerCase().includes(query.toLowerCase())
    );

    let results: any[] = [];

    if (matchedByTitle.length > 0) {
      // Found in Anikoto – use its data
      results = matchedByTitle.map((item: any) => ({
        id: `anikoto-${item.id}`,
        anikotoId: item.id,
        title: item.title || item.alternative || 'Unknown',
        image: item.poster || 'https://via.placeholder.com/200x300',
        description: item.description || '',
        episodes: parseInt(item.episodes) || 0,
        type: item.terms_by_type?.type?.[0] || 'TV',
        year: item.year || new Date().getFullYear(),
        score: parseFloat(item.score) || 0,
        genre: item.terms_by_type?.genre?.join(', ') || '',
        studio: item.terms_by_type?.studios?.[0] || 'Unknown',
        status: item.status || 'Ongoing',
        mal_id: item.mal_id,
        source: 'anikoto'
      }));
    } else {
      // Step 3: Fallback to Jikan API search
      const jikanRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000)
      });
      if (!jikanRes.ok) {
        throw new Error('Jikan API error');
      }
      const jikanData = await jikanRes.json();
      const jikanResults = jikanData.data || [];

      if (jikanResults.length === 0) {
        return NextResponse.json({ results: [] });
      }

      // Try to match by mal_id with the Anikoto items we already fetched
      for (const jikanItem of jikanResults) {
        const malId = jikanItem.mal_id;
        const found = allItems.find((item: any) => item.mal_id == malId);
        if (found) {
          // Use Anikoto data
          results.push({
            id: `anikoto-${found.id}`,
            anikotoId: found.id,
            title: found.title || jikanItem.title,
            image: found.poster || jikanItem.images?.jpg?.image_url || 'https://via.placeholder.com/200x300',
            description: found.description || jikanItem.synopsis || '',
            episodes: parseInt(found.episodes) || jikanItem.episodes || 0,
            type: found.terms_by_type?.type?.[0] || jikanItem.type || 'TV',
            year: found.year || new Date().getFullYear(),
            score: parseFloat(found.score) || jikanItem.score || 0,
            genre: found.terms_by_type?.genre?.join(', ') || jikanItem.genres?.map((g: any) => g.name).join(', ') || '',
            studio: found.terms_by_type?.studios?.[0] || jikanItem.studios?.[0]?.name || 'Unknown',
            status: found.status || jikanItem.status || 'Ongoing',
            mal_id: malId,
            source: 'anikoto'
          });
        } else {
          // Not found in Anikoto – still return but with mal_id for fallback
          results.push({
            id: `jikan-${malId}`,
            anikotoId: null,
            title: jikanItem.title,
            image: jikanItem.images?.jpg?.image_url || 'https://via.placeholder.com/200x300',
            description: jikanItem.synopsis || '',
            episodes: jikanItem.episodes || 0,
            type: jikanItem.type || 'TV',
            year: jikanItem.year || new Date().getFullYear(),
            score: jikanItem.score || 0,
            genre: jikanItem.genres?.map((g: any) => g.name).join(', ') || '',
            studio: jikanItem.studios?.[0]?.name || 'Unknown',
            status: jikanItem.status || 'Ongoing',
            mal_id: malId,
            source: 'jikan_fallback',
            note: 'Not found on Anikoto – will use MAL endpoint for playback'
          });
        }
      }
    }

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error('Anikoto search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}