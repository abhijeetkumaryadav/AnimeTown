// worker/src/api/news.js

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
      // GET /api/news
      if (request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM news ORDER BY created_at DESC'
        ).all();

        const news = results.map(row => ({
          id: row.id,
          title: row.title,
          content: row.content || '',
          image: row.image || '',
          status: row.status || 'draft',
          created_at: row.created_at
        }));

        return new Response(JSON.stringify({ news }), {
          headers: corsHeaders
        });
      }

      // POST /api/news
      if (request.method === 'POST') {
        const data = await getJson();
        const id = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO news (id, title, content, image, status)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          id,
          data.title || '',
          data.content || '',
          data.image || '',
          data.status || 'draft'
        ).run();

        return new Response(JSON.stringify({
          success: true,
          news: { id, ...data }
        }), {
          headers: corsHeaders
        });
      }

      // PUT /api/news
      if (request.method === 'PUT') {
        const data = await getJson();
        const { id, ...updates } = data;

        await env.DB.prepare(`
          UPDATE news SET
            title = ?, content = ?, image = ?, status = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(
          updates.title || '',
          updates.content || '',
          updates.image || '',
          updates.status || 'draft',
          id
        ).run();

        return new Response(JSON.stringify({
          success: true,
          news: { id, ...updates }
        }), {
          headers: corsHeaders
        });
      }

      // DELETE /api/news
      if (request.method === 'DELETE') {
        const { id } = await getJson();
        await env.DB.prepare('DELETE FROM news WHERE id = ?').bind(id).run();
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