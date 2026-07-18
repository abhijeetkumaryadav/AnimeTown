// lib/db-client.ts
// This handles ALL Cloudflare D1 operations

const API_BASE = 'https://anime-cms.animetown.workers.dev/api';

// ---------- GLOBAL CACHE ----------
let cachedAnime: any[] | null = null;
let fetchPromise: Promise<any[]> | null = null;

export const CloudflareAPI = {
  // ---------- ANIME ----------
  // Fetch all anime and cache it (once) – returns the raw array
  getAllAnime: async (): Promise<any[]> => {
    if (cachedAnime) return cachedAnime;
    if (fetchPromise) {
      await fetchPromise;
      return cachedAnime!;
    }
    fetchPromise = (async (): Promise<any[]> => {
      const res = await fetch(`${API_BASE}/anime`);
      const data = await res.json();
      const animeList = data.anime || [];
      cachedAnime = animeList;
      return animeList;
    })();
    await fetchPromise;
    return cachedAnime!;
  },

  // Backward-compatible method – returns { anime: [...] } (the shape used by Home, Search, etc.)
  getAnime: async (): Promise<{ anime: any[] }> => {
    const list = await CloudflareAPI.getAllAnime();
    return { anime: list };
  },

  // Fetch by IDs using the cached full list (no network call after first load)
  getAnimeByIds: async (ids: string[]): Promise<{ anime: any[] }> => {
    if (!ids || ids.length === 0) return { anime: [] };
    const all = await CloudflareAPI.getAllAnime();
    const idSet = new Set(ids);
    const filtered = all.filter(a => idSet.has(a.id));
    return { anime: filtered };
  },

  // Other methods (POST, PUT, DELETE) remain unchanged
  postAnime: async (data: any) => {
    const res = await fetch(`${API_BASE}/anime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  putAnime: async (data: any) => {
    const res = await fetch(`${API_BASE}/anime`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteAnime: async (id: string) => {
    const res = await fetch(`${API_BASE}/anime`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.json();
  },

  // ---------- EPISODES ----------
  getEpisodes: async () => {
    const res = await fetch(`${API_BASE}/episodes`);
    return res.json();
  },

  postEpisode: async (data: any) => {
    const res = await fetch(`${API_BASE}/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  putEpisode: async (data: any) => {
    const res = await fetch(`${API_BASE}/episodes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteEpisode: async (id: string) => {
    const res = await fetch(`${API_BASE}/episodes`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.json();
  },

  // ---------- SCHEDULE ----------
  getSchedule: async () => {
    const res = await fetch(`${API_BASE}/schedule`);
    return res.json();
  },

  postSchedule: async (data: any) => {
    const res = await fetch(`${API_BASE}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  putSchedule: async (data: any) => {
    const res = await fetch(`${API_BASE}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteSchedule: async (id: string) => {
    const res = await fetch(`${API_BASE}/schedule`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.json();
  },

  // ---------- NEWS ----------
  getNews: async () => {
    const res = await fetch(`${API_BASE}/news`);
    return res.json();
  },

  postNews: async (data: any) => {
    const res = await fetch(`${API_BASE}/news`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  putNews: async (data: any) => {
    const res = await fetch(`${API_BASE}/news`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteNews: async (id: string) => {
    const res = await fetch(`${API_BASE}/news`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.json();
  },

  // ---------- FEATURED ----------
  getFeatured: async () => {
    const res = await fetch(`${API_BASE}/featured`);
    return res.json();
  },

  putFeatured: async (ids: string[]) => {
    const res = await fetch(`${API_BASE}/featured`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return res.json();
  },

  // ---------- NEWLY ADDED ----------
  getNewlyAdded: async () => {
    const res = await fetch(`${API_BASE}/newly-added`);
    return res.json();
  },

  putNewlyAdded: async (ids: string[]) => {
    const res = await fetch(`${API_BASE}/newly-added`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return res.json();
  },
};