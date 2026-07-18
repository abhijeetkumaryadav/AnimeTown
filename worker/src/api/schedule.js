// worker/src/api/schedule.js

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

    const getJson = async () => {
      try {
        return await request.json();
      } catch {
        return {};
      }
    };

    try {
      // GET /api/schedule
      if (request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM schedule ORDER BY day ASC, time ASC'
        ).all();

        const schedule = results.map(row => ({
          id: row.id,
          day: row.day,
          time: row.time,
          title: row.title || '',
          episode: row.episode || 1,
          link: row.link || '',
          anime_id: row.anime_id,
          created_at: row.created_at
        }));

        return new Response(JSON.stringify({ schedule }), {
          headers: corsHeaders
        });
      }

      // POST /api/schedule
      if (request.method === 'POST') {
        const data = await getJson();
        const id = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO schedule (id, day, time, title, episode, link, anime_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          data.day || 0,
          data.time || '18:00',
          data.title || '',
          data.episode || 1,
          data.link || '',
          data.anime_id || null
        ).run();

        return new Response(JSON.stringify({
          success: true,
          item: { id, ...data }
        }), {
          headers: corsHeaders
        });
      }

      // PUT /api/schedule
      if (request.method === 'PUT') {
        const data = await getJson();
        const { id, ...updates } = data;

        await env.DB.prepare(`
          UPDATE schedule SET
            day = ?, time = ?, title = ?, episode = ?,
            link = ?, anime_id = ?
          WHERE id = ?
        `).bind(
          updates.day || 0,
          updates.time || '18:00',
          updates.title || '',
          updates.episode || 1,
          updates.link || '',
          updates.anime_id || null,
          id
        ).run();

        return new Response(JSON.stringify({
          success: true,
          item: { id, ...updates }
        }), {
          headers: corsHeaders
        });
      }

      // DELETE /api/schedule
      if (request.method === 'DELETE') {
        const { id } = await getJson();
        await env.DB.prepare('DELETE FROM schedule WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true }), {
          headers: corsHeaders
        });
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: corsHeaders
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};