// worker/src/api/check-password.js

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'POST') {
      try {
        const { password } = await request.json();
        const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'kalavathi devi';

        if (password === ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ success: true }), {
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify({ success: false }), {
          status: 401,
          headers: corsHeaders
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders
    });
  }
};