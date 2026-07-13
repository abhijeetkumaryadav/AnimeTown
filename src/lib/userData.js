// src/lib/userData.js
import { supabase } from '@/lib/supabaseClient';

// ==================== BOOKMARKS ====================
export async function addBookmark(userId, animeId) {
  const { error } = await supabase
    .from('bookmarks')
    .upsert({ user_id: userId, anime_id: animeId }, { onConflict: 'user_id,anime_id' });
  return !error;
}

export async function removeBookmark(userId, animeId) {
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('anime_id', animeId);
  return !error;
}

export async function getBookmarks(userId) {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('anime_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data.map(b => b.anime_id);
}

// ==================== WATCH HISTORY ====================
export async function updateWatchProgress(userId, animeId, episodeNumber, progress = 0) {
  const { error } = await supabase
    .from('watch_history')
    .upsert({
      user_id: userId,
      anime_id: animeId,
      last_episode: episodeNumber,
      progress,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,anime_id' });
  return !error;
}

// ... add other functions as needed (getContinueWatching, addActivity, etc.) from your provided code.
// They all follow the same pattern using `supabase`. 
 
