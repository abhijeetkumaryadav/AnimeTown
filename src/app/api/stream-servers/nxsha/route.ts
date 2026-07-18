import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('search') || '';

  if (!query) {
    return NextResponse.json({ error: 'Search query required' }, { status: 400 });
  }

  try {
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

    const results: any[] = [];
    const seen = new Set<string>();

    // Find all links that point to /tv/ or /movie/ with a numeric ID
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const match = href.match(/^\/(tv|movie)\/(\d+)/);
      if (!match) return;

      const type = match[1];
      const id = match[2];
      const key = `${type}-${id}`;

      if (seen.has(key)) return;
      seen.add(key);

      // Title
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

      // Image
      let image = '';
      const img = $(el).find('img').first();
      if (img.length) {
        image = img.attr('src') || '';
        if (image && !image.startsWith('http')) {
          image = `https://web.nxsha.app${image}`;
        }
      }

      // Description
      let description = '';
      const parent = $(el).closest('div');
      const descEl = parent.find('.description, [class*="desc"]').first();
      if (descEl.length) {
        description = descEl.text().trim();
      }

      results.push({
        id: `${type}-${id}`,
        tmdbId: parseInt(id),
        type: type === 'tv' ? 'TV' : 'Movie',
        title: title,
        image: image || 'https://via.placeholder.com/200x300',
        description: description || 'No description available.',
        episodes: type === 'tv' ? 12 : 0,
        score: 0,
        genre: '',
        studio: 'Unknown',
        status: type === 'tv' ? 'Ongoing' : 'Released',
        year: new Date().getFullYear(),
        source: 'nxsha'
      });
    });

    // Fallback selector (if the above fails)
    if (results.length === 0) {
      $('.card, [class*="card"], .item, [class*="item"]').each((_, el) => {
        const link = $(el).find('a[href]').first();
        if (!link.length) return;
        const href = link.attr('href');
        if (!href) return;
        const match = href.match(/^\/(tv|movie)\/(\d+)/);
        if (!match) return;
        const type = match[1];
        const id = match[2];
        const key = `${type}-${id}`;
        if (seen.has(key)) return;
        seen.add(key);

        let title = $(el).find('h3, h4, .title').first().text().trim() || `${type === 'tv' ? 'TV Show' : 'Movie'} ${id}`;
        let image = $(el).find('img').first().attr('src') || '';
        if (image && !image.startsWith('http')) {
          image = `https://web.nxsha.app${image}`;
        }

        results.push({
          id: `${type}-${id}`,
          tmdbId: parseInt(id),
          type: type === 'tv' ? 'TV' : 'Movie',
          title: title,
          image: image || 'https://via.placeholder.com/200x300',
          description: '',
          episodes: type === 'tv' ? 12 : 0,
          score: 0,
          genre: '',
          studio: 'Unknown',
          status: type === 'tv' ? 'Ongoing' : 'Released',
          year: new Date().getFullYear(),
          source: 'nxsha'
        });
      });
    }

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error('Nxsha search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}