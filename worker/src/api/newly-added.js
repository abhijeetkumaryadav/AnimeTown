export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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
      // GET /api/newly-added
      if (request.method === 'GET') {
        // FIX: Use .bind() for parameters
        const { results } = await env.DB.prepare(
          'SELECT * FROM newly_added WHERE id = ?'
        ).bind('newly_added_ids').all();

        let ids = [];
        if (results.length > 0) {
          ids = JSON.parse(results[0].anime_ids || '[]');
        }

        return new Response(JSON.stringify({ newlyAdded: ids }), {
          headers: corsHeaders
        });
      }

      // PUT /api/newly-added
      if (request.method === 'PUT') {
        const { ids } = await getJson();

        await env.DB.prepare(`
          INSERT OR REPLACE INTO newly_added (id, anime_ids)
          VALUES (?, ?)
        `).bind(
          'newly_added_ids',
          JSON.stringify(ids || [])
        ).run();

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