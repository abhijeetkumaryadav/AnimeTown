// src/lib/animeApis.js
// Anime API integrations for auto-fetching data with unique IDs and full error handling

const JIKAN_BASE = 'https://api.jikan.moe/v4';
const ANILIST_API = 'https://graphql.anilist.co';
const KITSU_BASE = 'https://kitsu.io/api/edge';

// Helper to generate unique IDs
function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== JIKAN API ====================
export async function searchJikan(query, type = 'anime') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${JIKAN_BASE}/${type}?q=${encodeURIComponent(query)}&limit=10&sfw=true`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Jikan error: ${res.status}`);
    const data = await res.json();
    return data.data?.map(item => formatJikanAnime(item)) || [];
  } catch (error) {
    console.error('Jikan search error:', error.message);
    return [];
  }
}

export async function getJikanAnimeDetails(malId) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${JIKAN_BASE}/anime/${malId}/full`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Jikan error: ${res.status}`);
    const data = await res.json();
    return formatJikanAnime(data.data);
  } catch (error) {
    console.error('Jikan details error:', error.message);
    return null;
  }
}

export async function getJikanSeasonal(year, season) {
  try {
    const seasonPath = (year && season) ? `${year}/${season}` : 'now';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${JIKAN_BASE}/seasons/${seasonPath}?limit=15`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const fallbackRes = await fetch(`${JIKAN_BASE}/seasons/now?limit=15`);
      if (!fallbackRes.ok) throw new Error('Jikan seasonal failed');
      const fallbackData = await fallbackRes.json();
      return fallbackData.data?.map(item => formatJikanAnime(item)) || [];
    }
    const data = await res.json();
    return data.data?.map(item => formatJikanAnime(item)) || [];
  } catch (error) {
    console.error('Jikan seasonal error:', error.message);
    return [];
  }
}

export async function getJikanTop(type = 'anime', filter = 'bypopularity', limit = 10) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${JIKAN_BASE}/top/${type}?filter=${filter}&limit=${limit}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Jikan error: ${res.status}`);
    const data = await res.json();
    return data.data?.map(item => formatJikanAnime(item)) || [];
  } catch (error) {
    console.error('Jikan top error:', error.message);
    return [];
  }
}

function formatJikanAnime(item) {
  return {
    id: uid('jikan'),
    mal_id: item.mal_id,
    title: item.title || item.title_english || 'Unknown',
    englishTitle: item.title_english || '',
    japaneseTitle: item.title_japanese || '',
    type: item.type || 'TV',
    episodes: item.episodes || 0,
    status: item.status || 'Not yet aired',
    score: item.score || 0,
    year: item.aired?.from ? new Date(item.aired.from).getFullYear() : item.year || '',
    season: item.season || '',
    genre: item.genres?.map(g => g.name).join(', ') || '',
    studio: item.studios?.map(s => s.name).join(', ') || '',
    image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '',
    description: item.synopsis || '',
    rating: item.rating || '',
    popularity: item.popularity || 0,
    rank: item.rank || 0,
    trailer: item.trailer?.url || '',
    source: 'jikan'
  };
}

// ==================== ANILIST API ====================
export async function searchAniList(query) {
  try {
    const queryStr = `
      query ($search: String) {
        Page(perPage: 10) {
          media(search: $search, type: ANIME) {
            id
            title { romaji english native }
            type
            episodes
            status
            averageScore
            seasonYear
            season
            genres
            studios { nodes { name } }
            coverImage { extraLarge large medium }
            description
            popularity
            rankings { rank type allTime }
            trailer { id site }
          }
        }
      }
    `;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: queryStr, variables: { search: query } }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`AniList error: ${res.status}`);
    const data = await res.json();
    return data.data?.Page?.media?.map(formatAniListAnime) || [];
  } catch (error) {
    console.error('AniList search error:', error.message);
    return [];
  }
}

export async function getAniListTrending() {
  try {
    const queryStr = `
      query {
        Page(perPage: 15) {
          media(sort: TRENDING_DESC, type: ANIME) {
            id
            title { romaji english native }
            type
            episodes
            status
            averageScore
            seasonYear
            season
            genres
            studios { nodes { name } }
            coverImage { extraLarge large }
            description
            popularity
          }
        }
      }
    `;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: queryStr }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`AniList error: ${res.status}`);
    const data = await res.json();
    return data.data?.Page?.media?.map(formatAniListAnime) || [];
  } catch (error) {
    console.error('AniList trending error:', error.message);
    return [];
  }
}

function formatAniListAnime(item) {
  return {
    id: uid('anilist'),
    anilist_id: item.id,
    title: item.title?.english || item.title?.romaji || 'Unknown',
    japaneseTitle: item.title?.native || '',
    type: item.type || 'TV',
    episodes: item.episodes || 0,
    status: item.status || 'Not yet aired',
    score: (item.averageScore / 10) || 0,
    year: item.seasonYear || '',
    season: item.season || '',
    genre: item.genres?.join(', ') || '',
    studio: item.studios?.nodes?.map(s => s.name).join(', ') || '',
    image: item.coverImage?.extraLarge || item.coverImage?.large || '',
    description: item.description?.replace(/<[^>]*>/g, '').substring(0, 300) || '',
    popularity: item.popularity || 0,
    rank: item.rankings?.[0]?.rank || 0,
    trailer: item.trailer?.id ? `https://www.youtube.com/watch?v=${item.trailer.id}` : '',
    source: 'anilist'
  };
}

// ==================== KITSU API ====================
export async function searchKitsu(query) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${KITSU_BASE}/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=10`, {
      headers: { 'Accept': 'application/vnd.api+json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Kitsu error: ${res.status}`);
    const data = await res.json();
    return data.data?.map(item => ({
      id: uid('kitsu'),
      kitsu_id: item.id,
      title: item.attributes?.canonicalTitle || item.attributes?.titles?.en || item.attributes?.titles?.en_jp || 'Unknown',
      japaneseTitle: item.attributes?.titles?.ja_jp || '',
      type: item.attributes?.showType || 'TV',
      episodes: item.attributes?.episodeCount || 0,
      status: item.attributes?.status || 'Unknown',
      score: parseFloat(item.attributes?.averageRating) || 0,
      year: item.attributes?.startDate?.substring(0, 4) || '',
      genre: item.attributes?.genres?.join(', ') || '',
      image: item.attributes?.posterImage?.original || item.attributes?.posterImage?.large || '',
      description: item.attributes?.synopsis || '',
      popularity: item.attributes?.popularityRank || 0,
      source: 'kitsu'
    })) || [];
  } catch (error) {
    console.error('Kitsu search error:', error.message);
    return [];
  }
}

// ==================== COMBINED SEARCH ====================
export async function combinedSearch(query) {
  try {
    const [jikanResults, anilistResults, kitsuResults] = await Promise.allSettled([
      searchJikan(query),
      searchAniList(query),
      searchKitsu(query)
    ]);

    const allResults = [
      ...(jikanResults.status === 'fulfilled' ? jikanResults.value : []),
      ...(anilistResults.status === 'fulfilled' ? anilistResults.value : []),
      ...(kitsuResults.status === 'fulfilled' ? kitsuResults.value : [])
    ];

    const unique = [];
    const seen = new Set();
    for (const item of allResults) {
      const normalized = item.title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (!seen.has(normalized) && item.image) {
        seen.add(normalized);
        unique.push(item);
      }
    }
    return unique.slice(0, 15);
  } catch (error) {
    console.error('Combined search error:', error);
    return [];
  }
}

// ==================== CONVERT API RESULT TO OUR FORMAT ====================
export function apiResultToAnime(apiResult) {
  return {
    title: apiResult.title || 'Unknown',
    type: apiResult.type === 'TV' ? 'TV' : apiResult.type === 'Movie' ? 'Movie' : apiResult.type === 'Special' ? 'Special' : apiResult.type || 'TV',
    status: apiResult.status === 'Currently Airing' ? 'Ongoing' : apiResult.status === 'Finished Airing' ? 'Completed' : apiResult.status === 'Not yet aired' ? 'Upcoming' : 'Ongoing',
    episodes: apiResult.episodes || 12,
    score: apiResult.score || 0,
    year: apiResult.year || new Date().getFullYear().toString(),
    genre: apiResult.genre || '',
    studio: apiResult.studio || '',
    image: apiResult.image || '',
    description: (apiResult.description || '').substring(0, 500),
    popularity: apiResult.popularity || 0,
    rank: apiResult.rank || 0,
    trailer: apiResult.trailer || '',
    source: apiResult.source || 'unknown'
  };
}

// ==================== NEWS FETCH (uses server-side API route) ====================
export async function fetchAnimeNews() {
  try {
    const res = await fetch('/api/news-fetch');
    const data = await res.json();
    return data.articles || [];
  } catch (error) {
    console.error('Failed to fetch news:', error);
    return [];
  }
}