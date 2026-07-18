// worker/src/api/anime.js

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // GET /api/anime
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

      // POST /api/anime
      if (request.method === 'POST') {
        // Parse the request body directly
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

        const id = crypto.randomUUID();

        // Log what we received for debugging
        console.log('Received data:', JSON.stringify(data));

        // Map fields properly with explicit extraction
        const title = data.title || data.english || data.romaji || 'Untitled';
        const description = data.description || data.synopsis || '';
        const episodes = typeof data.episodes === 'number' ? data.episodes : (parseInt(data.episodes) || 0);
        const genre = data.genre || data.genres || '';
        const image = data.image || data.coverImage || data.poster || '';
        const popularity = typeof data.popularity === 'number' ? data.popularity : (parseInt(data.popularity) || 0);
        const rank = typeof data.rank === 'number' ? data.rank : (parseInt(data.rank) || 0);
        const score = typeof data.score === 'number' ? data.score : (parseFloat(data.score) || 0);
        const source = data.source || 'anilist';
        const status = data.status || 'Ongoing';
        const studio = data.studio || '';
        const trailer = data.trailer || '';
        const type = data.type || 'ANIME';
        const year = typeof data.year === 'number' ? data.year : (parseInt(data.year) || 0);

        // Log what we're inserting
        console.log('Inserting:', { id, title, episodes, score });

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

      // PUT /api/anime
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

      // DELETE /api/anime
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