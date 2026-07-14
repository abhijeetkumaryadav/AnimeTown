"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import {
  Search, Play, Bookmark, CheckCircle2, XCircle,
  Plus, ChevronRight, MoreVertical, Trash2, LogIn, History, Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useApp } from '@/lib/AppContext';

// ============================================================
// TYPES
// ============================================================
type StatusType = 'Watch Later' | 'Watching' | 'Completed' | 'Dropped';

interface Anime {
  id: number;
  title: string;
  image: string;
  type: string;
  score: number;
  status: string;
}

interface WatchlistItem {
  id: number;
  title: string;
  image: string;
  type: string;
}

interface DisplayItem extends WatchlistItem {
  animeData: Anime;
  status: StatusType | null;
}

// ============================================================
// CACHE HELPERS
// ============================================================
function getUserCacheKey(userId: string) {
  return `myListCache_${userId}`;
}

function getCachedData(userId: string) {
  if (typeof window === 'undefined') return null;
  try {
    const cacheRaw = localStorage.getItem(getUserCacheKey(userId));
    if (!cacheRaw) return null;
    return JSON.parse(cacheRaw);
  } catch {
    return null;
  }
}

function saveCacheData(userId: string, data: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getUserCacheKey(userId), JSON.stringify(data));
  } catch {}
}

// ============================================================
// FULL‑SCREEN LOGIN PROMPT (unchanged)
// ============================================================
function LoginPrompt({ navigateTo }: any) {
  const animeBgs = [
    { url: "https://mir-s3-cdn-cf.behance.net/projects/808/f5ac43143597009.Y3JvcCwxMDIyLDgwMCwwLDA.png", title: "Anime Background 1" },
    { url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR8swO_xYt1scLZRSI3Hg3jbYDx23nD57pbJhlSsdbhRg&s=10", title: "Anime Background 2" },
    { url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRnssjXHQiIzGD11ItMU6J7MOYVQTDJqXn4uspIJymEQA&s=10", title: "Anime Background 3" },
    { url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRv4eetsh4aC1t-RpwDJCOU--ZzDGA0Ecbdp7MdSKTqjg&s=10", title: "Anime Background 4" },
    { url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT5Xcj96NYaM_Hm24mqoQIvHIpNsxUU7Gdo84YHzos2Sg&s=10", title: "Anime Background 5" },
    { url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR9ECU0F2FXU87l09kWIXT0gVuSkikTxKfLhDZQoR2t6Q&s=10", title: "Anime Background 6" },
    { url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRG6Vzf1GlYQlMTnpy5YqvZnTG2iSo-uU0AVW1ls4BshQ&s=10", title: "Anime Background 7" },
  ];

  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % animeBgs.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [animeBgs.length]);

  const currentBg = animeBgs[bgIndex];

  const particles = useMemo(() => [...Array(20)].map(() => ({
    width: Math.random() * 4 + 2,
    height: Math.random() * 4 + 2,
    top: Math.random() * 100,
    left: Math.random() * 100,
    animationDelay: Math.random() * 3,
    animationDuration: Math.random() * 3 + 2,
  })), []);

  return (
    <div className="min-h-screen bg-[#06070d] text-zinc-100 flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={currentBg.url} alt={currentBg.title} className="w-full h-full object-cover transition-all duration-1000" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#06070d]/95 via-[#06070d]/90 to-[#06070d]/95" />
        <div className="absolute inset-0 bg-gradient-to-t from-amber-900/20 via-transparent to-purple-900/20" />
        <div className="absolute inset-0 overflow-hidden">
          {particles.map((p, i) => (
            <div key={i} className="absolute rounded-full bg-white/10 animate-pulse"
              style={{ width: p.width + 'px', height: p.height + 'px', top: p.top + '%', left: p.left + '%', animationDelay: p.animationDelay + 's', animationDuration: p.animationDuration + 's' }} />
          ))}
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {animeBgs.map((_, i) => (
          <button key={i} onClick={() => setBgIndex(i)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${i === bgIndex ? 'bg-amber-500 w-6' : 'bg-white/20 hover:bg-white/40'}`} />
        ))}
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              <Bookmark className="w-8 h-8 text-amber-400" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Access Your List</h1>
          <p className="text-white/50 text-sm mb-8 max-w-xs mx-auto">
            Sign in to save your favorite anime, track your progress, and pick up where you left off.
          </p>
          <button
            onClick={() => {
              if (navigateTo) navigateTo('profile');
              else window.location.href = '/profile';
            }}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
          >
            <LogIn className="w-4 h-4" />
            Sign In to Continue
          </button>
          <p className="text-white/20 text-xs mt-4">Don’t have an account? You’ll be able to create one instantly.</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SKELETON
// ============================================================
function SkeletonCard() {
  return (
    <div className="bg-[#0b0b10] border border-zinc-900 p-2.5 rounded-xl md:rounded-2xl flex items-center gap-3.5 animate-pulse">
      <div className="w-24 md:w-28 aspect-[16/10] bg-zinc-800 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 bg-zinc-800 rounded w-3/4" />
        <div className="h-3 bg-zinc-800 rounded w-1/2" />
        <div className="h-3 bg-zinc-800 rounded w-1/3" />
      </div>
      <div className="w-6 h-6 bg-zinc-800 rounded-full" />
    </div>
  );
}

function SkeletonPlaceholder() {
  return (
    <div className="min-h-screen bg-[#040406] text-zinc-100 font-sans selection:bg-amber-500 flex flex-col">
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-5 pb-24 md:pb-12">
        <div className="space-y-0.5">
          <div className="h-7 bg-zinc-800 rounded w-24 animate-pulse" />
          <div className="h-4 bg-zinc-800 rounded w-48 animate-pulse" />
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-zinc-900/40 pb-1">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-8 w-24 bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-10 bg-zinc-800 rounded-xl animate-pulse" />
        <div className="flex justify-between items-center">
          <div className="h-4 bg-zinc-800 rounded w-16 animate-pulse" />
          <div className="h-4 bg-zinc-800 rounded w-8 animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
        </div>
      </main>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function MyListPage({
  navigateTo,
}: {
  navigateTo?: (page: string, tab?: string, params?: any) => void;
}) {
  const { user: contextUser, loading: authLoading } = useApp();

  const [hydrated, setHydrated] = useState(false);

  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [rawWatchlist, setRawWatchlist] = useState<WatchlistItem[]>([]);
  const [itemStatuses, setItemStatuses] = useState<Record<number, StatusType>>({});
  const [watchHistory, setWatchHistory] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [localUser, setLocalUser] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<string>('Watch Later');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ---- Instant cache load ----
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const cachedUserRaw = localStorage.getItem('profileUser');
    let cachedUser: any = null;
    if (cachedUserRaw) {
      try {
        cachedUser = JSON.parse(cachedUserRaw);
        setLocalUser(cachedUser);
      } catch {}
    }

    if (cachedUser?.id) {
      const cached = getCachedData(cachedUser.id);
      if (cached) {
        setAnimeList(cached.animeList || []);
        setRawWatchlist(cached.watchlist || []);
        setItemStatuses(cached.statuses || {});
        setWatchHistory(cached.rawWatchHistory || []);
        setDataLoading(false);
      }
    }

    setHydrated(true);
  }, []);

  // ---- Fetch anime list ----
  useEffect(() => {
    const fetchAnime = async () => {
      try {
        const res = await fetch('/api/anime');
        const data = await res.json();
        const freshAnime = data.anime || [];
        setAnimeList(freshAnime);
        const effectiveUser = contextUser || localUser;
        if (effectiveUser?.id) {
          const cached = getCachedData(effectiveUser.id);
          if (cached) {
            saveCacheData(effectiveUser.id, { ...cached, animeList: freshAnime });
          }
        }
      } catch (error) {
        console.error('Failed to fetch anime:', error);
      }
    };
    fetchAnime();
  }, []);

  // ---- Load user data from Supabase ----
  const loadUserData = useCallback(async () => {
    const effectiveUser = contextUser || localUser;
    if (!effectiveUser) {
      setRawWatchlist([]);
      setItemStatuses({});
      setWatchHistory([]);
      setDataLoading(false);
      return;
    }

    try {
      const [bookmarksRes, statusRes, watchHistoryRes] = await Promise.all([
        supabase.from('bookmarks').select('anime_id').eq('user_id', effectiveUser.id),
        supabase.from('user_anime_status').select('anime_id, status').eq('user_id', effectiveUser.id),
        supabase.from('watch_history').select('anime_id, last_episode, progress, updated_at').eq('user_id', effectiveUser.id).order('updated_at', { ascending: false }),
      ]);

      if (bookmarksRes.error) throw bookmarksRes.error;
      const bookmarkedIds = bookmarksRes.data.map((b: any) => b.anime_id);

      // Map custom statuses
      const statusMap: Record<number, StatusType> = {};
      if (statusRes.data) {
        statusRes.data.forEach((s: any) => {
          if (s.status === 'Watching') statusMap[s.anime_id] = 'Watching';
          else if (s.status === 'Completed') statusMap[s.anime_id] = 'Completed';
          else if (s.status === 'Dropped') statusMap[s.anime_id] = 'Dropped';
          else statusMap[s.anime_id] = 'Watch Later';
        });
      }

      const currentAnimeList: Anime[] = animeList.length > 0 ? animeList : (getCachedData(effectiveUser.id)?.animeList || []);
      const validAnimeIds = new Set(currentAnimeList.map(a => a.id));

      const watchlistItems: WatchlistItem[] = currentAnimeList
        .filter((a) => bookmarkedIds.includes(a.id) && validAnimeIds.has(a.id))
        .map((a) => ({ id: a.id, title: a.title, image: a.image, type: a.type }));

      const historyItems = (watchHistoryRes.data || []).filter((item: any) => validAnimeIds.has(item.anime_id));

      setRawWatchlist(watchlistItems);
      setItemStatuses(statusMap);
      setWatchHistory(historyItems);

      saveCacheData(effectiveUser.id, {
        animeList: currentAnimeList,
        watchlist: watchlistItems,
        statuses: statusMap,
        rawWatchHistory: historyItems,
      });

      if (dataLoading) setDataLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      if (dataLoading) setDataLoading(false);
    }
  }, [contextUser, localUser, animeList, dataLoading]);

  useEffect(() => {
    const timer = setTimeout(() => { loadUserData(); }, 0);
    return () => clearTimeout(timer);
  }, [loadUserData]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadUserData();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadUserData]);

  // ---- Derived data ----
  const displayItems: DisplayItem[] = useMemo(() => {
    return rawWatchlist
      .map((item): DisplayItem | null => {
        const anime = animeList.find((a) => a.id === item.id);
        if (!anime) return null;
        const status: StatusType = itemStatuses[item.id] || 'Watch Later';
        return {
          ...item,
          animeData: anime,
          status,
        };
      })
      .filter((item): item is DisplayItem => item !== null);
  }, [rawWatchlist, itemStatuses, animeList]);

  // Watch History items – exclude Completed and Dropped
  const watchHistoryItems: DisplayItem[] = useMemo(() => {
    return watchHistory
      .map((wh): DisplayItem | null => {
        const anime = animeList.find((a) => a.id === wh.anime_id);
        if (!anime) return null;
        const status: StatusType | null = itemStatuses[wh.anime_id] || null;
        return {
          id: wh.anime_id,
          title: anime.title,
          image: anime.image,
          type: anime.type,
          animeData: anime,
          status,
        };
      })
      .filter((item): item is DisplayItem => {
        if (item === null) return false;
        if (item.status === 'Completed' || item.status === 'Dropped') return false;
        return true;
      });
  }, [watchHistory, animeList, itemStatuses]);

  // ---- Tab filtering ----
  const filteredByTab = useMemo(() => {
    if (activeTab === 'Watch Later') {
      return displayItems.filter(item => item.status === 'Watch Later');
    }
    else if (activeTab === 'Watch History') {
      return watchHistoryItems;
    }
    else {
      return displayItems.filter((item) => item.status === activeTab);
    }
  }, [displayItems, activeTab, watchHistoryItems]);

  const searchedItems = useMemo(() => {
    if (searchQuery.trim() === '') return filteredByTab;
    return filteredByTab.filter((item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [filteredByTab, searchQuery]);

  // ---- Handlers ----
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openWatch = useCallback((animeId: number) => {
    if (navigateTo) navigateTo('watch', undefined, { anime: animeId });
    else window.location.href = `/watch?anime=${animeId}`;
  }, [navigateTo]);

  const removeFromWatchlist = async (id: number) => {
    const effectiveUser = contextUser || localUser;
    if (!effectiveUser) return;
    try {
      await Promise.all([
        supabase.from('bookmarks').delete().eq('user_id', effectiveUser.id).eq('anime_id', id),
        supabase.from('user_anime_status').delete().eq('user_id', effectiveUser.id).eq('anime_id', id),
      ]);
      const updatedWatchlist = rawWatchlist.filter((item) => item.id !== id);
      const newStatuses = { ...itemStatuses };
      delete newStatuses[id];
      setRawWatchlist(updatedWatchlist);
      setItemStatuses(newStatuses);
      setOpenMenuId(null);
      saveCacheData(effectiveUser.id, { animeList, watchlist: updatedWatchlist, statuses: newStatuses, rawWatchHistory: watchHistory });
    } catch (error) {
      console.error('Error removing:', error);
    }
  };

  const changeStatus = async (animeId: number, newStatus: StatusType) => {
    const effectiveUser = contextUser || localUser;
    if (!effectiveUser) return;
    try {
      await supabase
        .from('user_anime_status')
        .upsert({
          user_id: effectiveUser.id,
          anime_id: animeId,
          status: newStatus,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,anime_id' });

      const updatedStatuses = { ...itemStatuses, [animeId]: newStatus };
      setItemStatuses(updatedStatuses);
      setOpenMenuId(null);
      saveCacheData(effectiveUser.id, { animeList, watchlist: rawWatchlist, statuses: updatedStatuses, rawWatchHistory: watchHistory });
    } catch (error) {
      console.error('Error changing status:', error);
    }
  };

  const tabs = [
    { name: 'Watch Later', icon: <Bookmark className="w-3.5 h-3.5" /> },
    { name: 'Watch History', icon: <History className="w-3.5 h-3.5" /> },
    { name: 'Completed', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { name: 'Dropped', icon: <XCircle className="w-3.5 h-3.5" /> },
  ];

  const statusColors: Record<string, string> = {
    'Watch Later': 'bg-amber-900/20 text-amber-400 border-amber-800/30',
    Watching: 'bg-blue-950/30 text-blue-400 border-blue-900/30',
    Completed: 'bg-emerald-950/30 text-emerald-400 border-emerald-900/30',
    Dropped: 'bg-red-950/30 text-red-400 border-red-900/30',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    'Watch Later': <Bookmark className="w-2.5 h-2.5" />,
    Watching: <Clock className="w-2.5 h-2.5" />,
    Completed: <CheckCircle2 className="w-2.5 h-2.5" />,
    Dropped: <XCircle className="w-2.5 h-2.5" />,
  };

  const getStatusBarColor = (status: string | null) => {
    switch (status) {
      case 'Watching': return 'bg-blue-600';
      case 'Completed': return 'bg-emerald-600';
      case 'Dropped': return 'bg-red-600';
      case 'Watch Later': return 'bg-amber-500';
      default: return 'bg-amber-500';
    }
  };

  // ---- RENDER GATES ----
  if (!hydrated) return <SkeletonPlaceholder />;
  if (!localUser && !contextUser) return <LoginPrompt navigateTo={navigateTo} />;

  return (
    <div className="min-h-screen bg-[#040406] text-zinc-100 font-sans selection:bg-amber-500 flex flex-col" suppressHydrationWarning>
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-5 pb-24 md:pb-12">

        {/* HEADER – desktop side‑by‑side */}
        <div className="hidden md:flex items-center justify-between gap-6">
          <div className="shrink-0">
            <h1 className="text-2xl font-black tracking-tight text-white">My List</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Track your anime journey</p>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.name;
              return (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold tracking-wide border transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20'
                      : 'bg-[#0b0b10]/40 border-zinc-900 text-zinc-500 hover:text-amber-400 hover:border-amber-500/50'
                  }`}
                >
                  {tab.icon}
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden flex gap-2 overflow-x-auto scrollbar-none border-b border-zinc-900/40 pb-1">
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.name;
            return (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-bold tracking-wide border transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20'
                    : 'bg-[#0b0b10]/40 border-zinc-900 text-zinc-500 hover:text-amber-400 hover:border-amber-500/50'
                }`}
              >
                {tab.icon}
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* SEARCH */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            placeholder="Search in your list..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0b0b10] border border-zinc-900 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium placeholder-zinc-600 text-zinc-200 focus:outline-none focus:border-amber-500/40 transition-colors"
          />
        </div>

        {/* CONTENT */}
        <div className="space-y-3">
          {dataLoading ? (
            [1,2,3,4,5].map(i => <SkeletonCard key={i} />)
          ) : searchedItems.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {activeTab === 'Watch Later'
                  ? 'Your list is empty'
                  : activeTab === 'Watch History'
                  ? 'No active watch history'
                  : `Nothing in ${activeTab}`}
              </p>
              <p className="text-xs mt-1">
                {activeTab === 'Watch Later'
                  ? 'Browse anime and click the bookmark icon to add them here.'
                  : activeTab === 'Watch History'
                  ? 'Start watching anime to build your history. Completed or dropped titles appear in their respective tabs.'
                  : 'Change an item\'s status using the menu to move it here.'}
              </p>
            </div>
          ) : (
            searchedItems.map((item) => {
              const anime = item.animeData;
              const status = item.status;
              return (
                <div
                  key={item.id}
                  className="bg-[#0b0b10] border border-zinc-900 p-2.5 rounded-xl md:rounded-2xl flex items-center gap-3.5 hover:border-amber-500/20 transition-all group relative"
                >
                  {/* IMAGE */}
                  <div
                    className="w-24 md:w-28 aspect-[16/10] rounded-lg overflow-hidden bg-zinc-900 relative shrink-0 cursor-pointer"
                    onClick={() => openWatch(anime.id)}
                  >
                    <img
                      src={anime.image}
                      alt={anime.title}
                      loading="lazy"
                      className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-300"
                    />
                    <div
                      className={`absolute top-0 left-2 w-3.5 h-5 rounded-b-xs shadow-md flex items-center justify-center ${getStatusBarColor(status)}`}
                    >
                      <div className="w-1 h-1 bg-white rounded-full opacity-80" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-7 h-7 bg-black/50 backdrop-blur-xs rounded-full border border-zinc-800/60 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all">
                        <Play className="w-2.5 h-2.5 text-white fill-current translate-x-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* DETAILS */}
                  <div
                    className="flex-1 min-w-0 pr-10 space-y-1"
                    onClick={() => openWatch(anime.id)}
                  >
                    <h3 className="text-xs md:text-sm font-bold text-zinc-200 group-hover:text-amber-400 transition-colors truncate leading-tight cursor-pointer">
                      {anime.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold text-zinc-500">
                      <span>{anime.type}</span>
                      <span>•</span>
                      <span>{anime.status}</span>
                      <span>•</span>
                      <span className="text-amber-400">★ {anime.score}</span>
                    </div>
                    {status && (
                      <div className="pt-0.5">
                        <span
                          className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border flex items-center gap-1 w-fit ${statusColors[status] || statusColors['Watch Later']}`}
                        >
                          {statusIcons[status] || statusIcons['Watch Later']}
                          {status}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* MENU */}
                  <div
                    className="relative"
                    ref={openMenuId === item.id ? menuRef : null}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === item.id ? null : item.id);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-amber-400 transition-colors p-1.5 rounded-lg"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === item.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-[#16161e] border border-zinc-800 rounded-xl p-1.5 shadow-2xl z-50">
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-3 py-1.5">
                          Move to
                        </p>
                        {tabs.filter(t => t.name !== 'Watch History').map((tab) => (
                          <button
                            key={tab.name}
                            onClick={(e) => {
                              e.stopPropagation();
                              changeStatus(item.id, tab.name as StatusType);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold transition-colors ${
                              status === tab.name
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                            }`}
                          >
                            {tab.icon}
                            {tab.name}
                            {status === tab.name && (
                              <CheckCircle2 className="w-3 h-3 ml-auto text-amber-400" />
                            )}
                          </button>
                        ))}
                        <div className="border-t border-zinc-800 mt-1 pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromWatchlist(item.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold text-red-400 hover:bg-red-950/30 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove from List
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DISCOVER BUTTON */}
        <button
          onClick={() => {
            if (navigateTo) navigateTo('home');
            else window.location.href = '/';
          }}
          className="w-full py-3.5 bg-[#0b0b10] border border-zinc-900 rounded-xl md:rounded-2xl text-[11px] md:text-xs font-black tracking-wide text-zinc-300 hover:border-amber-500/30 hover:text-white transition-all flex items-center justify-between px-4 mt-2"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-amber-900/20 border border-amber-800/30 rounded-md flex items-center justify-center text-amber-500">
              <Plus className="w-3.5 h-3.5" />
            </div>
            Discover More Anime
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
        </button>
      </main>
    </div>
  );
}