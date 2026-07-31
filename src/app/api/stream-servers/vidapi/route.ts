import { NextRequest, NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'f53d9598f4e3d849706245ce05804a46';
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmNTNkOTU5OGY0ZTNkODQ5NzA2MjQ1Y2UwNTgwNGE0NiIsIm5iZiI6MTc4NTM4ODkxOS4xMDA5OTk4LCJzdWIiOiI2YTZhZGY3NzMzMzJlYmQwYWNhYzhhYjQiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.1yuCJDAVOpts5kVbhBzKBWHKWTlFIkAwxGfTFmB23GM';
const TMDB_BASE = 'https://api.themoviedb.org/3';

// ============================================================
//   HELPER FUNCTIONS
// ============================================================

/**
 * Extract season number from the title string.
 * Handles patterns like "Season 2", "Part 2", "Final Season", "S2", "Season 3 Part 2"
 */
function extractSeasonFromTitle(title: string): number {
  if (!title) return 1;

  // Check for "Season X Part Y"
  const seasonPartMatch = title.match(/Season\s*(\d+)\s*Part\s*(\d+)/i);
  if (seasonPartMatch) {
    return parseInt(seasonPartMatch[1]);
  }

  // Check for "Part X" without season
  const partMatch = title.match(/Part\s*(\d+)/i);
  if (partMatch && !title.toLowerCase().includes('season')) {
    return parseInt(partMatch[1]);
  }

  // Check for "Season X"
  const seasonMatch = title.match(/Season\s*(\d+)/i);
  if (seasonMatch) {
    return parseInt(seasonMatch[1]);
  }

  // Check for "Final Season"
  if (/Final\s*Season/i.test(title)) return 4;

  // Check for "SX" pattern (e.g., "S2")
  const sMatch = title.match(/S(\d+)/i);
  if (sMatch) {
    return parseInt(sMatch[1]);
  }

  return 1;
}

/**
 * Fetch IMDB ID for a given MAL ID using Jikan API.
 * Falls back to TMDB external_ids if Jikan fails.
 */
async function fetchImdbFromJikan(malId: number): Promise<string | null> {
  try {
    // 1. Try Jikan external endpoint
    const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}/external`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidAPI/1.0)' },
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json();
      const external = data.data || [];
      for (const link of external) {
        if (link.name?.toLowerCase().includes('imdb')) {
          const match = link.url.match(/tt\d+/);
          if (match) return match[0];
        }
      }
    }

    // 2. Fallback: fetch the full anime data from Jikan (includes external links)
    const animeResponse = await fetch(`https://api.jikan.moe/v4/anime/${malId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidAPI/1.0)' },
      signal: AbortSignal.timeout(5000)
    });

    if (animeResponse.ok) {
      const data = await animeResponse.json();
      const anime = data.data;
      if (anime && anime.external) {
        for (const link of anime.external) {
          if (link.name?.toLowerCase().includes('imdb')) {
            const match = link.url.match(/tt\d+/);
            if (match) return match[0];
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Jikan IMDB fetch error for MAL ID', malId, error);
    return null;
  }
}

/**
 * Search TMDB for a TV show by title and (optional) year.
 */
async function searchTMDBTV(title: string, year?: number): Promise<string | null> {
  try {
    const url = `${TMDB_BASE}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&include_adult=false`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    const data = await response.json();
    const results = data.results || [];

    let bestMatch = null;
    let bestScore = 0;
    for (const result of results) {
      const isAnime = result.original_language === 'ja' ||
        (result.genre_ids && result.genre_ids.includes(16));
      const releaseYear = result.first_air_date ? new Date(result.first_air_date).getFullYear() : null;
      let score = result.popularity || 0;
      if (year && releaseYear === year) score += 100;
      const resultTitle = (result.name || '').toLowerCase();
      if (resultTitle === title.toLowerCase()) score += 200;
      if (resultTitle.includes(title.toLowerCase())) score += 50;
      if (isAnime) score += 50;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = String(result.id);
      }
    }
    return bestMatch;
  } catch (error) {
    console.error('TMDB TV search error:', error);
    return null;
  }
}

/**
 * Search TMDB for a Movie by title and (optional) year.
 */
async function searchTMDBMovie(title: string, year?: number): Promise<string | null> {
  try {
    const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&include_adult=false`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    const data = await response.json();
    const results = data.results || [];

    let bestMatch = null;
    let bestScore = 0;
    for (const result of results) {
      const isAnime = result.original_language === 'ja' ||
        (result.genre_ids && result.genre_ids.includes(16));
      const releaseYear = result.release_date ? new Date(result.release_date).getFullYear() : null;
      let score = result.popularity || 0;
      if (year && releaseYear === year) score += 100;
      const resultTitle = (result.title || '').toLowerCase();
      if (resultTitle === title.toLowerCase()) score += 200;
      if (resultTitle.includes(title.toLowerCase())) score += 50;
      if (isAnime) score += 50;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = String(result.id);
      }
    }
    return bestMatch;
  } catch (error) {
    console.error('TMDB Movie search error:', error);
    return null;
  }
}

// ============================================================
//   MAIN SEARCH FUNCTION
// ============================================================

async function searchAniList(query: string): Promise<any[]> {
  try {
    // 1. Query AniList
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query ($search: String) {
            Page(page: 1, perPage: 12) {
              media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
                id
                idMal
                seasonInt
                title { romaji english native }
                coverImage { large }
                description
                episodes
                format
                status
                averageScore
                startDate { year }
                genres
                studios { nodes { name } }
                externalLinks {
                  site
                  id
                  url
                }
              }
            }
          }
        `,
        variables: { search: query }
      })
    });

    const data = await response.json();
    const media = data?.data?.Page?.media || [];

    const results: any[] = [];
    let parentTvShowId: string | null = null; // used to share TMDB ID across seasons

    // 2. Process each result
    for (const anime of media) {
      let imdb_id: string | null = null;
      let tmdb_id: string | null = null;
      const mediaType = (anime.format || 'TV').toLowerCase();

      // --- Determine season number ---
      const titleText = anime.title?.english || anime.title?.romaji || '';
      let seasonNumber = extractSeasonFromTitle(titleText);
      // If AniList has a reasonable seasonInt, prefer it
      if (anime.seasonInt && anime.seasonInt >= 1 && anime.seasonInt <= 10) {
        seasonNumber = anime.seasonInt;
      }

      // --- 2a. Extract IDs from AniList external links ---
      for (const link of anime.externalLinks || []) {
        const site = link.site || '';
        let id = link.id;
        if (!id && link.url) {
          if (site === 'IMDB') {
            const match = link.url.match(/tt\d+/);
            if (match) id = match[0];
          } else if (site === 'TMDB' || site === 'The Movie Database') {
            const match = link.url.match(/\/(\d+)/);
            if (match) id = match[1];
          }
        }
        if (site === 'IMDB' && id && id.startsWith('tt')) imdb_id = id;
        if ((site === 'TMDB' || site === 'The Movie Database') && id) tmdb_id = id;
      }

      // --- 2b. If no TMDB, search TMDB API ---
      if (!tmdb_id) {
        const searchTitle = anime.title?.english || anime.title?.romaji || '';
        const year = anime.startDate?.year;
        if (mediaType === 'movie') {
          tmdb_id = await searchTMDBMovie(searchTitle, year);
        } else {
          tmdb_id = await searchTMDBTV(searchTitle, year);
        }
      }

      // --- 2c. If no IMDB, fetch from Jikan (using MAL ID) ---
      if (!imdb_id && anime.idMal) {
        imdb_id = await fetchImdbFromJikan(anime.idMal);
      }

      // --- 2d. If still no IMDB, try TMDB external_ids endpoint (fallback) ---
      if (!imdb_id && tmdb_id) {
        try {
          // TMDB stores IMDB IDs in the external_ids endpoint
          const endpoint = mediaType === 'movie'
            ? `${TMDB_BASE}/movie/${tmdb_id}/external_ids`
            : `${TMDB_BASE}/tv/${tmdb_id}/external_ids`;
          const tmdbResp = await fetch(`${endpoint}?api_key=${TMDB_API_KEY}`, {
            headers: { 'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}` },
            signal: AbortSignal.timeout(5000)
          });
          if (tmdbResp.ok) {
            const extData = await tmdbResp.json();
            if (extData.imdb_id) imdb_id = extData.imdb_id;
          }
        } catch (error) {
          console.error('TMDB IMDB fetch error:', error);
        }
      }

      // --- 2e. Fallback for seasons/OVAs: reuse parent show's TMDB ID ---
      if (!tmdb_id && mediaType !== 'movie') {
        const cleanTitle = titleText
          .replace(/\s*Season\s*\d+/i, '')
          .replace(/\s*Part\s*\d+/i, '')
          .replace(/\s*OVA.*$/i, '')
          .replace(/\s*Special.*$/i, '')
          .replace(/\s*Final\s*Season.*$/i, '')
          .trim();
        if (parentTvShowId && cleanTitle) {
          const parentMatch = results.find(r =>
            r.title.toLowerCase().includes(cleanTitle.toLowerCase()) &&
            r.tmdb_id
          );
          if (parentMatch) {
            tmdb_id = parentMatch.tmdb_id;
            // OVAs and Specials usually use season 1
            if (mediaType === 'ova' || mediaType === 'special') {
              seasonNumber = 1;
            }
          }
        }
      }

      // --- Store parent show ID for future fallback ---
      if (tmdb_id && (mediaType === 'tv' || mediaType === 'ova' || mediaType === 'special')) {
        parentTvShowId = tmdb_id;
      }

      // --- Build result object ---
      results.push({
        id: `vidapi-${anime.id}`,
        anilistId: anime.id,
        title: anime.title?.english || anime.title?.romaji || 'Unknown',
        image: anime.coverImage?.large || 'https://via.placeholder.com/200x300',
        description: anime.description?.replace(/<[^>]*>/g, '') || '',
        episodes: anime.episodes || 0,
        type: mediaType,
        year: anime.startDate?.year || new Date().getFullYear(),
        score: (anime.averageScore || 0) / 10,
        genre: anime.genres?.join(', ') || '',
        studio: anime.studios?.nodes?.[0]?.name || 'Unknown',
        status: anime.status || 'Ongoing',
        imdb_id: imdb_id,
        tmdb_id: tmdb_id,
        mal_id: anime.idMal,
        season: seasonNumber,
        source: 'vidapi'
      });
    }

    return results;
  } catch (error) {
    console.error('VidAPI search error:', error);
    return [];
  }
}

// ============================================================
//   GET HANDLER
// ============================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('search') || '';

  if (!query) {
    return NextResponse.json({ error: 'Search query required' }, { status: 400 });
  }

  const results = await searchAniList(query);
  return NextResponse.json({ results });
}