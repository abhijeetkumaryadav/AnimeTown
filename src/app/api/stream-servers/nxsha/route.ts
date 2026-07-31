import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// ---------- Title cleaning ----------
function cleanTitle(title: string): string {
  if (!title) return 'Unknown';
  let cleaned = title.replace(/^\d+\.\d+\s*/, '');
  cleaned = cleaned.replace(/^NR\s*/, '');
  cleaned = cleaned.replace(/\(Coming\s+soon\)/i, '').replace(/Coming\s+soon/i, '');
  cleaned = cleaned.replace(/\s*,\s*\d{4}$/, '');
  cleaned = cleaned.replace(/^\d+\s*/, '');
  cleaned = cleaned.trim();
  return cleaned || 'Unknown';
}

function getPlaceholderImage(title: string): string {
  const firstLetter = (title || 'A').charAt(0).toUpperCase();
  return `https://placehold.co/200x300/0D8ABC/FFFFFF?text=${encodeURIComponent(firstLetter)}`;
}

// ---------- Robust Nxsha scraping ----------
async function scrapeNxsha(query: string, retries = 2): Promise<any[] | null> {
  const url = `https://web.nxsha.app/search?q=${encodeURIComponent(query)}`;

  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  ];

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const userAgent = userAgents[attempt % userAgents.length];
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Referer': 'https://web.nxsha.app/',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        console.warn(`Nxsha attempt ${attempt + 1} failed with status ${response.status}`);
        if (attempt === retries) return null;
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const scrapedResults: any[] = [];
      const seen = new Set<string>();

      // Main scraping
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

        let image = '';
        const img = $(el).find('img').first();
        if (img.length) {
          image = img.attr('src') || '';
          if (image && !image.startsWith('http')) {
            image = `https://web.nxsha.app${image}`;
          }
        }

        scrapedResults.push({
          tmdbId: id,
          type: type === 'tv' ? 'TV' : 'Movie',
          title: cleanTitle(title),
          image: image || getPlaceholderImage(title),
        });
      });

      // Fallback selector (if the above finds nothing)
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
          let image = '';
          const img = $(el).find('img').first();
          if (img.length) {
            image = img.attr('src') || '';
            if (image && !image.startsWith('http')) {
              image = `https://web.nxsha.app${image}`;
            }
          }
          scrapedResults.push({
            tmdbId: id,
            type: type === 'tv' ? 'TV' : 'Movie',
            title: cleanTitle(title),
            image: image || getPlaceholderImage(title),
          });
        });
      }

      if (scrapedResults.length > 0) {
        return scrapedResults;
      }
    } catch (error) {
      console.error(`Scrape attempt ${attempt + 1} error:`, error);
    }
  }
  return null;
}

// ---------- Main GET handler ----------
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('search') || '';

  if (!query) {
    return NextResponse.json({ error: 'Search query required' }, { status: 400 });
  }

  const scrapedResults = await scrapeNxsha(query, 3);

  if (!scrapedResults || scrapedResults.length === 0) {
    return NextResponse.json({
      results: [],
      message: 'No results from Nxsha. The service may be temporarily unavailable.',
    });
  }

  // Return the scraped data directly (no TMDB calls)
  const results = scrapedResults.map((item) => ({
    id: `nx-${item.tmdbId}`,
    tmdbId: item.tmdbId,
    type: item.type,
    title: item.title,
    image: item.image,
    description: 'No description available.', // We don't have this from Nxsha
    episodes: item.type === 'TV' ? 12 : 1, // Default, but the episode route will handle it
    score: 0,
    genre: '',
    studio: 'Unknown',
    status: item.type === 'TV' ? 'Ongoing' : 'Released',
    year: new Date().getFullYear().toString(),
    source: 'nxsha',
    season: 1,
    imdb_id: null,
  }));

  return NextResponse.json({ results });
}