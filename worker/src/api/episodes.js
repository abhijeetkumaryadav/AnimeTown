// worker/src/api/episodes.js

async function refreshEpisodeCache(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM episodes ORDER BY number ASC'
  ).all();
  
  const episodes = results.map(row => ({
    id: row.id,
    anime_id: row.anime_id,
    number: row.number,
    title: row.title || '',
    languages: JSON.parse(row.languages || '{}'),
    servers: JSON.parse(row.servers || '{}'),
    created_at: row.created_at
  }));
  
  await env.KV.put('episodes_list', JSON.stringify(episodes));
  console.log('✅ Episode cache refreshed');
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

    // ---------- GET – read from KV first ----------
    if (request.method === 'GET' && path === '/api/episodes') {
      try {
        const cached = await env.KV.get('episodes_list', 'json');
        if (cached) {
          return new Response(JSON.stringify({ episodes: cached }), {
            headers: corsHeaders
          });
        }
      } catch (e) {
        console.warn('KV read failed, falling back to D1:', e);
      }

      const { results } = await env.DB.prepare(
        'SELECT * FROM episodes ORDER BY number ASC'
      ).all();

      const episodes = results.map(row => ({
        id: row.id,
        anime_id: row.anime_id,
        number: row.number,
        title: row.title || '',
        languages: JSON.parse(row.languages || '{}'),
        servers: JSON.parse(row.servers || '{}'),
        created_at: row.created_at
      }));

      await env.KV.put('episodes_list', JSON.stringify(episodes));

      return new Response(JSON.stringify({ episodes }), {
        headers: corsHeaders
      });
    }

    // ---------- POST ----------
    if (request.method === 'POST' && path === '/api/episodes') {
      const requestBody = await request.text();
      let data;
      try {
        data = JSON.parse(requestBody);
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: corsHeaders
        });
      }

      const id = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO episodes (id, anime_id, number, title, languages, servers)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        data.anime_id,
        data.number,
        data.title || '',
        JSON.stringify(data.languages || {}),
        JSON.stringify(data.servers || {})
      ).run();

      await refreshEpisodeCache(env);

      return new Response(JSON.stringify({
        success: true,
        episode: { id, ...data }
      }), {
        headers: corsHeaders
      });
    }

    // ---------- PUT ----------
    if (request.method === 'PUT' && path === '/api/episodes') {
      const requestBody = await request.text();
      let data;
      try {
        data = JSON.parse(requestBody);
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: corsHeaders
        });
      }

      const { id, ...updates } = data;

      await env.DB.prepare(`
        UPDATE episodes SET
          anime_id = ?, number = ?, title = ?,
          languages = ?, servers = ?
        WHERE id = ?
      `).bind(
        updates.anime_id,
        updates.number,
        updates.title || '',
        JSON.stringify(updates.languages || {}),
        JSON.stringify(updates.servers || {}),
        id
      ).run();

      await refreshEpisodeCache(env);

      return new Response(JSON.stringify({
        success: true,
        episode: { id, ...updates }
      }), {
        headers: corsHeaders
      });
    }

    // ---------- DELETE ----------
    if (request.method === 'DELETE' && path === '/api/episodes') {
      const requestBody = await request.text();
      let data;
      try {
        data = JSON.parse(requestBody);
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: corsHeaders
        });
      }

      await env.DB.prepare('DELETE FROM episodes WHERE id = ?').bind(data.id).run();

      await refreshEpisodeCache(env);

      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders
    });
  }
};