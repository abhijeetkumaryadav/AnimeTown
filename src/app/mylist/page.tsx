"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Play, Bookmark, CheckCircle2, XCircle,
  Plus, ChevronRight, MoreVertical, Trash2, LogIn, History, Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { CloudflareAPI } from '@/lib/db-client';

// ============================================================
// TYPES
// ============================================================
type StatusType = 'Watch Later' | 'Watching' | 'Completed' | 'Dropped';

interface Anime {
  id: string;
  title: string;
  image: string;
  type: string;
  score: number;
  status: string;
}

interface WatchlistItem {
  id: string;
  title: string;
  image: string;
  type: string;
}

interface DisplayItem extends WatchlistItem {
  animeData: Anime;
  status: StatusType | null;
}

interface WatchHistoryItem {
  anime_id: string;
  last_episode: number;
  progress: number;
  updated_at: string;
}

// ============================================================
// CACHE HELPERS – SYNC
// ============================================================
function getUserCacheKey(userId: string) {
  return `myListCache_${userId}`;
}

function getCachedData(userId: string) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getUserCacheKey(userId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data._ts && Date.now() - data._ts > 30 * 60 * 1000) {
      localStorage.removeItem(getUserCacheKey(userId));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveCacheData(userId: string, data: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getUserCacheKey(userId), JSON.stringify({ ...data, _ts: Date.now() }));
  } catch {}
}

// 🔥 Synchronous user ID extraction from localStorage
function getUserIdFromLocalStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const keys = Object.keys(localStorage);
    const authKey = keys.find(k => k.startsWith('sb-') && k.includes('auth-token'));
    if (!authKey) return null;
    const raw = localStorage.getItem(authKey);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

// 🔥 Synchronous cache loader – runs before first render
function loadCachedData(): {
  userId: string | null;
  animeList: Anime[];
  watchlist: WatchlistItem[];
  statuses: Record<string, StatusType>;
  history: WatchHistoryItem[];
  hasCache: boolean;
} {
  const userId = getUserIdFromLocalStorage();
  if (!userId) {
    return { userId: null, animeList: [], watchlist: [], statuses: {}, history: [], hasCache: false };
  }
  const cached = getCachedData(userId);
  if (!cached) {
    return { userId, animeList: [], watchlist: [], statuses: {}, history: [], hasCache: false };
  }
  return {
    userId,
    animeList: cached.animeList || [],
    watchlist: cached.watchlist || [],
    statuses: cached.statuses || {},
    history: cached.rawWatchHistory || [],
    hasCache: true,
  };
}

// ============================================================
// EMPTY STATE ILLUSTRATION
// ============================================================
function EmptyStateIllustration() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-32 h-32 mx-auto">
      <circle cx="100" cy="100" r="80" fill="url(#ghostGlow)" opacity="0.15" />
      <path d="M60 120 C60 70 70 40 100 40 C130 40 140 70 140 120 L140 160 L125 145 L110 160 L95 145 L80 160 L65 145 L60 160 L60 120 Z" fill="url(#ghostGradient)" opacity="0.9" />
      <ellipse cx="85" cy="85" rx="8" ry="10" fill="#1a1a2e" opacity="0.4" />
      <ellipse cx="115" cy="85" rx="8" ry="10" fill="#1a1a2e" opacity="0.4" />
      <circle cx="87" cy="83" r="3" fill="#f59e0b" opacity="0.6" />
      <circle cx="117" cy="83" r="3" fill="#f59e0b" opacity="0.6" />
      <ellipse cx="78" cy="100" rx="8" ry="4" fill="#f59e0b" opacity="0.15" />
      <ellipse cx="122" cy="100" rx="8" ry="4" fill="#f59e0b" opacity="0.15" />
      <circle cx="150" cy="60" r="4" fill="#f59e0b" opacity="0.4" />
      <circle cx="165" cy="80" r="2.5" fill="#f59e0b" opacity="0.3" />
      <circle cx="50" cy="55" r="3" fill="#f59e0b" opacity="0.3" />
      <circle cx="40" cy="75" r="2" fill="#f59e0b" opacity="0.2" />
      <circle cx="155" cy="45" r="2" fill="#f59e0b" opacity="0.25" />
      <circle cx="45" cy="45" r="1.5" fill="#f59e0b" opacity="0.2" />
      <path d="M150 50 L152 45 L154 50 L149 47 L155 47 L150 50 Z" fill="#f59e0b" opacity="0.35" />
      <path d="M48 65 L50 60 L52 65 L47 62 L53 62 L48 65 Z" fill="#f59e0b" opacity="0.3" />
      <defs>
        <linearGradient id="ghostGradient" x1="100" y1="40" x2="100" y2="160">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
        </linearGradient>
        <radialGradient id="ghostGlow" cx="100" cy="100" r="80">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// ============================================================
// LOGIN PROMPT
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
    const interval = setInterval(() => { setBgIndex((prev) => (prev + 1) % animeBgs.length); }, 2000);
    return () => clearInterval(interval);
  }, []);
  const currentBg = animeBgs[bgIndex];
  const particles = useMemo(() => [...Array(20)].map(() => ({
    width: Math.random() * 4 + 2, height: Math.random() * 4 + 2,
    top: Math.random() * 100, left: Math.random() * 100,
    animationDelay: Math.random() * 3, animationDuration: Math.random() * 3 + 2,
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
          <p className="text-white/50 text-sm mb-8 max-w-xs mx-auto">Sign in to save your favorite anime, track your progress, and pick up where you left off.</p>
          <button onClick={() => { if (navigateTo) navigateTo('profile'); else window.location.href = '/profile'; }}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40">
            <LogIn className="w-4 h-4" /> Sign In to Continue
          </button>
          <p className="text-white/20 text-xs mt-4">Don’t have an account? You’ll be able to create one instantly.</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SKELETON (only if no cache or still loading)
// ============================================================
function SkeletonCard() {
  return (
    <div className="bg-[#0b0b10] border border-zinc-900 p-2.5 rounded-xl flex items-center gap-3.5 animate-pulse">
      <div className="w-24 aspect-[16/10] bg-zinc-800 rounded-lg shrink-0" />
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
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 space-y-5 pb-24">
        <div className="flex gap-2 overflow-x-auto border-b border-zinc-900/40 pb-1">
          {[1,2,3,4].map(i => (<div key={i} className="h-8 w-24 bg-zinc-800 rounded-xl animate-pulse" />))}
        </div>
        <div className="h-10 bg-zinc-800 rounded-xl animate-pulse" />
        <div className="space-y-3">{[1,2,3,4,5].map(i => <SkeletonCard key={i} />)}</div>
      </main>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT – with synchronous cache initialization
// ============================================================
export default function MyListPage({
  navigateTo,
}: {
  navigateTo?: (page: string, tab?: string, params?: any) => void;
}) {
  // --------------------------------------------
  // 🔥 Load cache synchronously BEFORE first render
  // --------------------------------------------
  const initialData = loadCachedData();

  // ---- State with initial values from cache ----
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(!initialData.hasCache);
  const [animeList, setAnimeList] = useState<Anime[]>(initialData.animeList);
  const [rawWatchlist, setRawWatchlist] = useState<WatchlistItem[]>(initialData.watchlist);
  const [itemStatuses, setItemStatuses] = useState<Record<string, StatusType>>(initialData.statuses);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>(initialData.history);
  const [dataLoading, setDataLoading] = useState(!initialData.hasCache);

  const [activeTab, setActiveTab] = useState<string>('Watch Later');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ---- If we had a valid user in the cache, keep it for now ----
  const [cachedUserId] = useState(initialData.userId);

  // ---- Auth check (runs after mount) ----
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setAuthChecking(false);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setAuthChecking(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ---- Fetch anime list (background) ----
  useEffect(() => {
    const fetchAnime = async () => {
      try {
        const data = await CloudflareAPI.getAnime();
        setAnimeList(prev => data.anime || prev);
      } catch (error) {
        console.error('Failed to fetch anime:', error);
      }
    };
    fetchAnime();
  }, []);

  // ---- Fresh data fetcher (runs after auth, updates state and cache) ----
  const fetchFreshData = useCallback(async () => {
    if (!user) return;
    const userId = user.id;

    try {
      const [bookmarksRes, statusRes, watchHistoryRes] = await Promise.all([
        supabase.from('bookmarks').select('anime_id').eq('user_id', userId),
        supabase.from('user_anime_status').select('anime_id, status').eq('user_id', userId),
        supabase.from('watch_history').select('anime_id, last_episode, progress, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }),
      ]);

      if (bookmarksRes.error) throw bookmarksRes.error;

      const bookmarkedIds: string[] = bookmarksRes.data.map((b: any) => String(b.anime_id));
      const statusMap: Record<string, StatusType> = {};
      if (statusRes.data) {
        statusRes.data.forEach((s: any) => {
          statusMap[String(s.anime_id)] = s.status as StatusType;
        });
      }

      const animeMap = new Map<string, Anime>();
      animeList.forEach(a => animeMap.set(String(a.id), a));

      const watchlistItems: WatchlistItem[] = bookmarkedIds
        .map(id => {
          const anime = animeMap.get(id);
          if (anime) {
            return { id: anime.id, title: anime.title, image: anime.image, type: anime.type };
          } else {
            return {
              id,
              title: `Unknown (ID: ${id.slice(0, 8)}...)`,
              image: 'https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=400&q=80',
              type: 'Unknown',
            };
          }
        });

      const validAnimeIds = new Set(animeList.map(a => String(a.id)));
      const historyItems: WatchHistoryItem[] = (watchHistoryRes.data || [])
        .filter((item: any) => validAnimeIds.has(String(item.anime_id)))
        .map((item: any) => ({
          anime_id: String(item.anime_id),
          last_episode: item.last_episode,
          progress: item.progress,
          updated_at: item.updated_at,
        }));

      setRawWatchlist(watchlistItems);
      setItemStatuses(statusMap);
      setWatchHistory(historyItems);

      // Save to cache
      saveCacheData(userId, {
        animeList,
        watchlist: watchlistItems,
        statuses: statusMap,
        rawWatchHistory: historyItems,
      });

      setDataLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      setDataLoading(false);
    }
  }, [user, animeList]);

  // Trigger fresh fetch when user is set and anime list is ready
  useEffect(() => {
    if (user && animeList.length > 0) {
      fetchFreshData();
    }
  }, [user, animeList, fetchFreshData]);

  // Refresh on tab visibility (only if user)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        fetchFreshData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, fetchFreshData]);

  // ---- Derived data ----
  const displayItems: DisplayItem[] = useMemo(() => {
    return rawWatchlist.map(item => {
      const anime = animeList.find(a => String(a.id) === String(item.id));
      if (!anime) {
        return {
          ...item,
          animeData: {
            id: item.id,
            title: item.title,
            image: item.image,
            type: item.type,
            score: 0,
            status: 'Unknown',
          },
          status: itemStatuses[item.id] || 'Watch Later',
        };
      }
      const status = itemStatuses[item.id] || 'Watch Later';
      return { ...item, animeData: anime, status };
    });
  }, [rawWatchlist, itemStatuses, animeList]);

  const watchHistoryItems: (DisplayItem & { lastEpisode: number; progress: number; updatedAt: string })[] = useMemo(() => {
    return watchHistory
      .map(wh => {
        const anime = animeList.find(a => String(a.id) === String(wh.anime_id));
        if (!anime) return null;
        return {
          id: wh.anime_id,
          title: anime.title,
          image: anime.image,
          type: anime.type,
          animeData: anime,
          status: itemStatuses[wh.anime_id] || null,
          lastEpisode: wh.last_episode,
          progress: wh.progress,
          updatedAt: wh.updated_at,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [watchHistory, animeList, itemStatuses]);

  const filteredByTab = useMemo(() => {
    if (activeTab === 'Watch Later') return displayItems.filter(item => item.status === 'Watch Later');
    if (activeTab === 'Watch History') return watchHistoryItems;
    return displayItems.filter(item => item.status === activeTab);
  }, [displayItems, activeTab, watchHistoryItems]);

  const searchedItems = useMemo(() => {
    if (searchQuery.trim() === '') return filteredByTab;
    return filteredByTab.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [filteredByTab, searchQuery]);

  // ---- Handlers ----
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openWatch = useCallback((animeId: string) => {
    if (navigateTo) navigateTo('watch', undefined, { anime: animeId });
    else window.location.href = `/watch?anime=${animeId}`;
  }, [navigateTo]);

  const removeFromWatchlist = async (id: string) => {
    if (!user) return;
    try {
      await Promise.all([
        supabase.from('bookmarks').delete().eq('user_id', user.id).eq('anime_id', id),
        supabase.from('user_anime_status').delete().eq('user_id', user.id).eq('anime_id', id),
      ]);
      const updatedWatchlist = rawWatchlist.filter(item => item.id !== id);
      const newStatuses = { ...itemStatuses };
      delete newStatuses[id];
      setRawWatchlist(updatedWatchlist);
      setItemStatuses(newStatuses);
      setOpenMenuId(null);
      if (user) {
        saveCacheData(user.id, { animeList, watchlist: updatedWatchlist, statuses: newStatuses, rawWatchHistory: watchHistory });
      }
    } catch (error) {
      console.error('Error removing:', error);
    }
  };

  const changeStatus = async (animeId: string, newStatus: StatusType) => {
    if (!user) return;
    try {
      await supabase
        .from('user_anime_status')
        .upsert({ user_id: user.id, anime_id: animeId, status: newStatus, updated_at: new Date().toISOString() }, { onConflict: 'user_id,anime_id' });
      const updatedStatuses = { ...itemStatuses, [animeId]: newStatus };
      setItemStatuses(updatedStatuses);
      setOpenMenuId(null);
      saveCacheData(user.id, { animeList, watchlist: rawWatchlist, statuses: updatedStatuses, rawWatchHistory: watchHistory });
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

  // ============================================================
  // RENDER – NO FLICKER
  // ============================================================

  const hasCache = initialData.hasCache;

  // 1. If still checking auth and no cache → show skeleton
  if (authChecking && !hasCache) {
    return <SkeletonPlaceholder />;
  }

  // 2. If no cache and no user → show login
  if (!hasCache && !user) {
    return <LoginPrompt navigateTo={navigateTo} />;
  }

  // 3. If data is still loading → show skeleton (prevents empty state flicker)
  if (dataLoading) {
    return <SkeletonPlaceholder />;
  }

  // 4. Otherwise → render content (with cache or fresh data)
  return (
    <div className="min-h-screen bg-[#040406] text-zinc-100 font-sans selection:bg-amber-500 flex flex-col" suppressHydrationWarning>
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-4 space-y-5 pb-28 md:pb-24 relative">
        {/* TABS */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none border-b border-zinc-900/40 pb-1">
          {tabs.map(tab => (
            <button key={tab.name} onClick={() => setActiveTab(tab.name)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-bold tracking-wide border transition-all whitespace-nowrap ${
                activeTab === tab.name
                  ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'bg-[#0b0b10]/40 border-zinc-900 text-zinc-500 hover:text-amber-400 hover:border-amber-500/50'
              }`}>
              {tab.icon}{tab.name}
            </button>
          ))}
        </div>

        {/* SEARCH */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input type="text" placeholder="Search in your list..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#0b0b10] border border-zinc-900 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium placeholder-zinc-600 text-zinc-200 focus:outline-none focus:border-amber-500/40 transition-colors" />
        </div>

        {/* CONTENT */}
        <div className="space-y-3 min-h-[300px]">
          {searchedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center min-h-[320px]">
              <EmptyStateIllustration />
              <h3 className="text-lg font-bold text-white mt-4">
                {activeTab === 'Watch Later' && 'Your list is empty'}
                {activeTab === 'Watch History' && 'No watch history yet'}
                {activeTab === 'Completed' && 'Nothing in Completed'}
                {activeTab === 'Dropped' && 'Nothing in Dropped'}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                {activeTab === 'Watch Later' && 'Browse anime and tap the bookmark icon to add them here.'}
                {activeTab === 'Watch History' && 'Start watching to build your history.'}
                {activeTab === 'Completed' && "Change an item's status using the menu to move it here."}
                {activeTab === 'Dropped' && "Change an item's status using the menu to move it here."}
              </p>
            </div>
          ) : (
            searchedItems.map(item => {
              const anime = item.animeData;
              const status = item.status;
              const isWatchHistory = activeTab === 'Watch History';
              const whItem = isWatchHistory ? (item as any) : null;

              return (
                <div key={item.id} className="bg-[#0b0b10] border border-zinc-900 p-2.5 rounded-xl flex items-center gap-3.5 hover:border-amber-500/20 transition-all group relative">
                  <div className="w-24 aspect-[16/10] rounded-lg overflow-hidden bg-zinc-900 relative shrink-0 cursor-pointer" onClick={() => openWatch(anime.id)}>
                    <img src={anime.image} alt={anime.title} loading="lazy" className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-300" />
                    <div className={`absolute top-0 left-2 w-3.5 h-5 rounded-b-xs shadow-md flex items-center justify-center ${getStatusBarColor(status)}`}>
                      <div className="w-1 h-1 bg-white rounded-full opacity-80" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-7 h-7 bg-black/50 backdrop-blur-xs rounded-full border border-zinc-800/60 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all">
                        <Play className="w-2.5 h-2.5 text-white fill-current translate-x-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 pr-10 space-y-1 cursor-pointer" onClick={() => openWatch(anime.id)}>
                    <h3 className="text-xs md:text-sm font-bold text-zinc-200 group-hover:text-amber-400 transition-colors truncate leading-tight">{anime.title}</h3>
                    <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold text-zinc-500">
                      <span>{anime.type}</span><span>•</span><span>{anime.status}</span><span>•</span><span className="text-amber-400">★ {anime.score}</span>
                    </div>

                    {isWatchHistory && whItem && (
                      <div className="space-y-1">
                        <p className="text-[9px] text-zinc-500">Ep {whItem.lastEpisode} &nbsp;·&nbsp; {new Date(whItem.updatedAt).toLocaleDateString()}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500" style={{ width: `${whItem.progress}%` }} />
                          </div>
                          <span className="text-[9px] text-zinc-500">{whItem.progress}%</span>
                        </div>
                      </div>
                    )}

                    {!isWatchHistory && status && (
                      <div className="pt-0.5">
                        <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border flex items-center gap-1 w-fit ${statusColors[status] || statusColors['Watch Later']}`}>
                          {statusIcons[status] || statusIcons['Watch Later']}{status}
                        </span>
                      </div>
                    )}

                    {isWatchHistory && status && (
                      <div className="pt-0.5">
                        <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border flex items-center gap-1 w-fit ${statusColors[status] || statusColors['Watch Later']}`}>
                          {statusIcons[status] || statusIcons['Watch Later']}{status}
                        </span>
                      </div>
                    )}
                  </div>

                  {!isWatchHistory && (
                    <div className="relative" ref={openMenuId === item.id ? menuRef : null}>
                      <button onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-amber-400 transition-colors p-1.5 rounded-lg">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === item.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-[#16161e] border border-zinc-800 rounded-xl p-1.5 shadow-2xl z-50">
                          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-3 py-1.5">Move to</p>
                          {tabs.filter(t => t.name !== 'Watch History').map(tab => (
                            <button key={tab.name} onClick={e => { e.stopPropagation(); changeStatus(item.id, tab.name as StatusType); }}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold transition-colors ${
                                status === tab.name ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                              }`}>
                              {tab.icon}{tab.name}
                              {status === tab.name && <CheckCircle2 className="w-3 h-3 ml-auto text-amber-400" />}
                            </button>
                          ))}
                          <div className="border-t border-zinc-800 mt-1 pt-1">
                            <button onClick={e => { e.stopPropagation(); removeFromWatchlist(item.id); }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold text-red-400 hover:bg-red-950/30 transition-colors">
                              <Trash2 className="w-3 h-3" /> Remove from List
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isWatchHistory && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <Play className="w-4 h-4 text-amber-400" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* DISCOVER MORE */}
        <div className="sticky bottom-0 left-0 right-0 bg-[#040406]/95 backdrop-blur-sm pt-3 pb-2 md:static md:bg-transparent md:backdrop-blur-none md:pt-0 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 mt-4">
          <button onClick={() => { if (navigateTo) navigateTo('home'); else window.location.href = '/'; }}
            className="w-full py-3.5 bg-[#0b0b10] border border-zinc-900 rounded-xl text-[11px] font-black tracking-wide text-zinc-300 hover:border-amber-500/30 hover:text-white transition-all flex items-center justify-between px-4 shadow-lg shadow-black/50">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-amber-900/20 border border-amber-800/30 rounded-md flex items-center justify-center text-amber-500"><Plus className="w-3.5 h-3.5" /></div>
              Discover More Anime
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
          </button>
        </div>
      </main>
    </div>
  );
}