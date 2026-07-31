import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'f53d9598f4e3d849706245ce05804a46';
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmNTNkOTU5OGY0ZTNkODQ5NzA2MjQ1Y2UwNTgwNGE0NiIsIm5iZiI6MTc4NTM4ODkxOS4xMDA5OTk4LCJzdWIiOiI2YTZhZGY3NzMzMzJlYmQwYWNhYzhhYjQiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.1yuCJDAVOpts5kVbhBzKBWHKWTlFIkAwxGfTFmB23GM';
const TMDB_BASE = 'https://api.themoviedb.org/3';

// ---------- Helpers ----------
function extractSeasonFromTitle(title: string): number {
  if (!title) return 1;
  const seasonMatch = title.match(/Season\s*(\d+)/i);
  if (seasonMatch) return parseInt(seasonMatch[1]);
  if (/Final\s*Season/i.test(title)) return 4;
  const partMatch = title.match(/Part\s*(\d+)/i);
  if (partMatch && !title.toLowerCase().includes('season')) return parseInt(partMatch[1]);
  const sMatch = title.match(/S(\d+)/i);
  if (sMatch) return parseInt(sMatch[1]);
  return 1;
}

async function getTMDBDetails(tmdbId: number, mediaType: 'tv' | 'movie'): Promise<any> {
  try {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data;
  } catch (error) {
    console.error('TMDB details fetch error:', error);
    return null;
  }
}

async function getTMDBExternalIds(tmdbId: number, mediaType: 'tv' | 'movie'): Promise<any> {
  try {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE}/${endpoint}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (error) {
    console.error('TMDB external IDs fetch error:', error);
    return null;
  }
}

// ---------- Main GET handler ----------
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('search') || '';

  if (!query) {
    return NextResponse.json({ error: 'Search query required' }, { status: 400 });
  }

  try {
    // 1. Scrape Nxsha search page
    const url = `https://web.nxsha.app/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch search page: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const scrapedResults: { tmdbId: number; type: 'tv' | 'movie'; title: string }[] = [];
    const seen = new Set<string>();

    // Find all links to /tv/ or /movie/
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const match = href.match(/^\/(tv|movie)\/(\d+)/);
      if (!match) return;
      const type = match[1] as 'tv' | 'movie';
      const id = parseInt(match[2]);
      const key = `${type}-${id}`;
      if (seen.has(key)) return;
      seen.add(key);

      // Try to get title from the element
      let title = $(el).text().trim();
      if (!title || title.length < 2) {
        const parent = $(el).closest('div');
        const titleEl = parent.find('h3, h4, .title, [class*="title"]').first();
        if (titleEl.length) {
          title = titleEl.text().trim();
        }
      }
      if (!title || title.length < 2) {
        title = `${type === 'tv' ? 'TV Show' : 'Movie'} ${id}`;
      }

      scrapedResults.push({ tmdbId: id, type, title });
    });

    // Fallback scraping if the above finds nothing
    if (scrapedResults.length === 0) {
      $('.card, [class*="card"], .item, [class*="item"]').each((_, el) => {
        const link = $(el).find('a[href]').first();
        if (!link.length) return;
        const href = link.attr('href');
        if (!href) return;
        const match = href.match(/^\/(tv|movie)\/(\d+)/);
        if (!match) return;
        const type = match[1] as 'tv' | 'movie';
        const id = parseInt(match[2]);
        const key = `${type}-${id}`;
        if (seen.has(key)) return;
        seen.add(key);

        let title = $(el).find('h3, h4, .title').first().text().trim() || `${type === 'tv' ? 'TV Show' : 'Movie'} ${id}`;
        scrapedResults.push({ tmdbId: id, type, title });
      });
    }

    // 2. Enrich each result with TMDB API data
    const enrichedResults = [];
    for (const item of scrapedResults) {
      const tmdbData = await getTMDBDetails(item.tmdbId, item.type);
      if (!tmdbData) {
        // Fallback: keep minimal data
        enrichedResults.push({
          id: `nx-${item.tmdbId}`,
          tmdbId: item.tmdbId,
          type: item.type === 'tv' ? 'TV' : 'Movie',
          title: item.title,
          image: 'https://via.placeholder.com/200x300',
          description: 'No description available.',
          episodes: item.type === 'tv' ? 12 : 1,
          score: 0,
          genre: '',
          studio: 'Unknown',
          status: item.type === 'tv' ? 'Ongoing' : 'Released',
          year: new Date().getFullYear(),
          source: 'nxsha',
          season: 1,
          imdb_id: null
        });
        continue;
      }

      // Extract data from TMDB
      const title = tmdbData.name || tmdbData.title || item.title;
      const posterPath = tmdbData.poster_path;
      const image = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : 'https://via.placeholder.com/200x300';
      const overview = tmdbData.overview || 'No description available.';
      const episodes = tmdbData.number_of_episodes || (item.type === 'tv' ? 12 : 1);
      const score = tmdbData.vote_average || 0;
      const genres = tmdbData.genres?.map((g: any) => g.name).join(', ') || '';
      const studio = tmdbData.production_companies?.[0]?.name || 'Unknown';
      const status = tmdbData.status === 'Ended' ? 'Completed' : (tmdbData.status || (item.type === 'tv' ? 'Ongoing' : 'Released'));
      const year = tmdbData.first_air_date ? new Date(tmdbData.first_air_date).getFullYear() :
                   tmdbData.release_date ? new Date(tmdbData.release_date).getFullYear() :
                   new Date().getFullYear();
      const mediaType = item.type;

      // Extract season from the original scraped title (might contain "Season X")
      const seasonNumber = extractSeasonFromTitle(item.title);

      // Fetch IMDB ID from TMDB external_ids
      let imdb_id = null;
      const extData = await getTMDBExternalIds(item.tmdbId, mediaType);
      if (extData && extData.imdb_id) imdb_id = extData.imdb_id;

      enrichedResults.push({
        id: `nx-${item.tmdbId}`,
        tmdbId: item.tmdbId,
        type: mediaType === 'tv' ? 'TV' : 'Movie',
        title: title,
        image: image,
        description: overview,
        episodes: episodes,
        score: parseFloat(score.toFixed(1)),
        genre: genres,
        studio: studio,
        status: status,
        year: year.toString(),
        source: 'nxsha',
        season: seasonNumber,
        imdb_id: imdb_id
      });
    }

    return NextResponse.json({ results: enrichedResults });

  } catch (error: any) {
    console.error('Nxsha search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}