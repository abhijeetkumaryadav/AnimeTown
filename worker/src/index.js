// worker/src/index.js

import animeHandler from './api/anime.js';
import episodesHandler from './api/episodes.js';
import scheduleHandler from './api/schedule.js';
import newsHandler from './api/news.js';
import featuredHandler from './api/featured.js';
import newlyAddedHandler from './api/newly-added.js';
import checkPasswordHandler from './api/check-password.js';

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

    // Handle preflight OPTIONS requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Root route – API information
    if (path === '/' || path === '') {
      return new Response(JSON.stringify({
        name: 'AnimeTown CMS API',
        version: '1.0.0',
        endpoints: [
          '/api/anime - GET, POST, PUT, DELETE',
          '/api/episodes - GET, POST, PUT, DELETE',
          '/api/schedule - GET, POST, PUT, DELETE',
          '/api/news - GET, POST, PUT, DELETE',
          '/api/featured - GET, PUT',
          '/api/newly-added - GET, PUT',
          '/api/check-password - POST'
        ]
      }), { headers: corsHeaders });
    }

    try {
      // Route requests to the appropriate handler
      if (path === '/api/anime' || path === '/api/anime/') {
        return await animeHandler.fetch(request, env);
      }
      if (path === '/api/episodes' || path === '/api/episodes/') {
        return await episodesHandler.fetch(request, env);
      }
      if (path === '/api/schedule' || path === '/api/schedule/') {
        return await scheduleHandler.fetch(request, env);
      }
      if (path === '/api/news' || path === '/api/news/') {
        return await newsHandler.fetch(request, env);
      }
      if (path === '/api/featured' || path === '/api/featured/') {
        return await featuredHandler.fetch(request, env);
      }
      if (path === '/api/newly-added' || path === '/api/newly-added/') {
        return await newlyAddedHandler.fetch(request, env);
      }
      if (path === '/api/check-password' || path === '/api/check-password/') {
        return await checkPasswordHandler.fetch(request, env);
      }

      // If no route matches, return 404
      return new Response(JSON.stringify({ error: 'Not found', path }), {
        status: 404,
        headers: corsHeaders
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};