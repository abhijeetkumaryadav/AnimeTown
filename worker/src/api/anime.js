// worker/src/api/anime.js

async function fetchAnimeImageFromJikan(title) {
  try {
    // Jikan rate limit: ~60 req/min – small delay to be safe
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await fetch(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`
    );
    if (!response.ok) {
      console.error(`Jikan API error: ${response.status}`);
      return '';
    }
    const data = await response.json();
    if (data.data && data.data.length > 0) {
      const first = data.data[0];
      // Prefer large JPG, fallback to webp
      return first.images?.jpg?.large_image_url ||
             first.images?.webp?.large_image_url ||
             '';
    }
    return '';
  } catch (e) {
    console.error('Jikan fetch error:', e);
    return '';
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ---------- GET (unchanged) ----------
      if (request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM animes ORDER BY created_at DESC'
        ).all();

        const anime = results.map(row => ({
          id: row.id,
          title: row.title || '',
          description: row.description || '',
          episodes: row.episodes || 0,
          genre: row.genre || '',
          image: row.image || '',
          popularity: row.popularity || 0,
          rank: row.rank || 0,
          score: row.score || 0,
          source: row.source || 'anilist',
          status: row.status || 'Ongoing',
          studio: row.studio || '',
          trailer: row.trailer || '',
          type: row.type || 'ANIME',
          year: row.year || 0,
          created_at: row.created_at
        }));

        return new Response(JSON.stringify({ anime }), {
          headers: corsHeaders
        });
      }

      // ---------- POST (UPDATED with auto-fetch) ----------
      if (request.method === 'POST') {
        const requestText = await request.text();
        let data = {};
        try {
          data = JSON.parse(requestText);
        } catch (e) {
          return new Response(JSON.stringify({
            error: 'Invalid JSON body',
            received: requestText
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // Extract fields
        const title = data.title || data.english || data.romaji || 'Untitled';
        const description = data.description || data.synopsis || '';
        const episodes = typeof data.episodes === 'number' ? data.episodes : (parseInt(data.episodes) || 0);
        const genre = data.genre || data.genres || '';
        let image = data.image || data.coverImage || data.poster || '';
        const popularity = typeof data.popularity === 'number' ? data.popularity : (parseInt(data.popularity) || 0);
        const rank = typeof data.rank === 'number' ? data.rank : (parseInt(data.rank) || 0);
        const score = typeof data.score === 'number' ? data.score : (parseFloat(data.score) || 0);
        const source = data.source || 'anilist';
        const status = data.status || 'Ongoing';
        const studio = data.studio || '';
        const trailer = data.trailer || '';
        const type = data.type || 'ANIME';
        const year = typeof data.year === 'number' ? data.year : (parseInt(data.year) || 0);

        // ---- NEW: auto-fetch real image if current one is placeholder ----
        const placeholderPatterns = ['placeholder', 'default', 'via.placeholder.com', 'dummy'];
        const isPlaceholder = !image || placeholderPatterns.some(p => image.includes(p));
        if (isPlaceholder) {
          const fetchedImage = await fetchAnimeImageFromJikan(title);
          if (fetchedImage) {
            image = fetchedImage;
            console.log(`✅ Auto-fetched image for "${title}": ${image}`);
          } else {
            // Optional: set a default fallback image here if you want
            // image = 'https://your-fallback-image.com/default.jpg';
            console.log(`⚠️ No image found for "${title}" on Jikan.`);
          }
        }

        const id = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO animes (
            id, title, description, episodes, genre, image,
            popularity, rank, score, source, status, studio,
            trailer, type, year
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          title,
          description,
          episodes,
          genre,
          image,
          popularity,
          rank,
          score,
          source,
          status,
          studio,
          trailer,
          type,
          year
        ).run();

        return new Response(JSON.stringify({
          success: true,
          anime: {
            id,
            title,
            description,
            episodes,
            genre,
            image,
            popularity,
            rank,
            score,
            source,
            status,
            studio,
            trailer,
            type,
            year
          }
        }), {
          headers: corsHeaders
        });
      }

      // ---------- PUT (unchanged) ----------
      if (request.method === 'PUT') {
        const requestText = await request.text();
        let data = {};
        try {
          data = JSON.parse(requestText);
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const { id, ...updates } = data;

        await env.DB.prepare(`
          UPDATE animes SET
            title = ?, description = ?, episodes = ?, genre = ?,
            image = ?, popularity = ?, rank = ?, score = ?,
            source = ?, status = ?, studio = ?, trailer = ?,
            type = ?, year = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(
          updates.title || '',
          updates.description || '',
          updates.episodes || 0,
          updates.genre || '',
          updates.image || '',
          updates.popularity || 0,
          updates.rank || 0,
          updates.score || 0,
          updates.source || 'anilist',
          updates.status || 'Ongoing',
          updates.studio || '',
          updates.trailer || '',
          updates.type || 'ANIME',
          updates.year || 0,
          id
        ).run();

        return new Response(JSON.stringify({
          success: true,
          anime: { id, ...updates }
        }), {
          headers: corsHeaders
        });
      }

      // ---------- DELETE (unchanged) ----------
      if (request.method === 'DELETE') {
        const requestText = await request.text();
        let data = {};
        try {
          data = JSON.parse(requestText);
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const { id } = data;

        await env.DB.prepare('DELETE FROM episodes WHERE anime_id = ?').bind(id).run();
        await env.DB.prepare('DELETE FROM animes WHERE id = ?').bind(id).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: corsHeaders
        });
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: corsHeaders
      });
    } catch (error) {
      console.error('Error in anime handler:', error);
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};