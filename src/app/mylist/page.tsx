"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import {
  Search, Play, Bookmark, Clock, CheckCircle2, XCircle,
  Plus, ChevronRight, MoreVertical, Trash2
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
  status: StatusType;
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
    <div className="min-h-screen bg-[#040406] text-zinc-100 font-sans selection:bg-red-600 flex flex-col">
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

  // ---- Hydration flag to prevent flicker ----
  const [hydrated, setHydrated] = useState(false);

  // ---- State ----
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [rawWatchlist, setRawWatchlist] = useState<WatchlistItem[]>([]);
  const [itemStatuses, setItemStatuses] = useState<Record<number, StatusType>>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [localUser, setLocalUser] = useState<any>(null);

  // UI
  const [activeTab, setActiveTab] = useState<StatusType>('Watch Later');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ---- Instant load from cache (before paint) ----
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    // Load cached user (same key as Profile page)
    const cachedUserRaw = localStorage.getItem('profileUser');
    let cachedUser: any = null;
    if (cachedUserRaw) {
      try {
        cachedUser = JSON.parse(cachedUserRaw);
        setLocalUser(cachedUser);
      } catch {}
    }

    // Load cached list data if we have a user
    if (cachedUser?.id) {
      const cached = getCachedData(cachedUser.id);
      if (cached) {
        setAnimeList(cached.animeList || []);
        setRawWatchlist(cached.watchlist || []);
        setItemStatuses(cached.statuses || {});
        setDataLoading(false); // cache is displayed immediately
      }
    }

    // Mark as hydrated – ready to show real UI
    setHydrated(true);
  }, []);

  // ---- Fetch anime list (background) ----
  useEffect(() => {
    const fetchAnime = async () => {
      try {
        const res = await fetch('/api/anime');
        const data = await res.json();
        const freshAnime = data.anime || [];
        setAnimeList(freshAnime);
        // Update cache if user exists
        const effectiveUser = contextUser || localUser;
        if (effectiveUser?.id) {
          const cached = getCachedData(effectiveUser.id);
          if (cached) {
            saveCacheData(effectiveUser.id, {
              ...cached,
              animeList: freshAnime,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch anime:', error);
      }
    };
    fetchAnime();
  }, []);

  // ---- Load user data from Supabase (silent background refresh) ----
  const loadUserData = useCallback(async () => {
    const effectiveUser = contextUser || localUser;
    if (!effectiveUser) {
      setRawWatchlist([]);
      setItemStatuses({});
      setDataLoading(false);
      return;
    }

    try {
      const [bookmarksRes, statusRes] = await Promise.all([
        supabase.from('bookmarks').select('anime_id').eq('user_id', effectiveUser.id),
        supabase.from('user_anime_status').select('anime_id, status').eq('user_id', effectiveUser.id),
      ]);

      if (bookmarksRes.error) throw bookmarksRes.error;
      const bookmarkedIds = bookmarksRes.data.map((b: any) => b.anime_id);

      const statusMap: Record<number, StatusType> = {};
      if (statusRes.data) {
        statusRes.data.forEach((s: any) => {
          statusMap[s.anime_id] = s.status as StatusType;
        });
      }

      // Build watchlist items from the current animeList (or from cache)
      const currentAnimeList: Anime[] = animeList.length > 0 ? animeList : (getCachedData(effectiveUser.id)?.animeList || []);
      const watchlistItems: WatchlistItem[] = currentAnimeList
        .filter((a) => bookmarkedIds.includes(a.id))
        .map((a) => ({
          id: a.id,
          title: a.title,
          image: a.image,
          type: a.type,
        }));

      setRawWatchlist(watchlistItems);
      setItemStatuses(statusMap);

      // Save cache for future instant loads
      saveCacheData(effectiveUser.id, {
        animeList: currentAnimeList,
        watchlist: watchlistItems,
        statuses: statusMap,
      });

      if (dataLoading) setDataLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      if (dataLoading) setDataLoading(false);
    }
  }, [contextUser, localUser, animeList, dataLoading]);

  // ---- Trigger background load ----
  useEffect(() => {
    const timer = setTimeout(() => {
      loadUserData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadUserData]);

  // Refresh when page becomes visible
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadUserData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadUserData]);

  // ---- Derived data ----
  const displayItems: DisplayItem[] = useMemo(() => {
    return rawWatchlist
      .map((item) => {
        const anime = animeList.find((a) => a.id === item.id);
        if (!anime) return null;
        return {
          ...item,
          animeData: anime,
          status: itemStatuses[item.id] || 'Watch Later',
        };
      })
      .filter((item): item is DisplayItem => item !== null);
  }, [rawWatchlist, itemStatuses, animeList]);

  const filteredByTab = useMemo(() => {
    return activeTab === 'Watch Later'
      ? displayItems
      : displayItems.filter((item) => item.status === activeTab);
  }, [displayItems, activeTab]);

  const searchedItems = useMemo(() => {
    if (searchQuery.trim() === '') return filteredByTab;
    return filteredByTab.filter((item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [filteredByTab, searchQuery]);

  const getTabCount = (tabName: StatusType): number => {
    if (tabName === 'Watch Later') return displayItems.length;
    return displayItems.filter((item) => item.status === tabName).length;
  };

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
    if (navigateTo) {
      navigateTo('watch', undefined, { anime: animeId });
    } else {
      window.location.href = `/watch?anime=${animeId}`;
    }
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
      saveCacheData(effectiveUser.id, {
        animeList,
        watchlist: updatedWatchlist,
        statuses: newStatuses,
      });
    } catch (error) {
      console.error('Error removing from watchlist:', error);
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

      const updatedStatuses = {
        ...itemStatuses,
        [animeId]: newStatus,
      };
      setItemStatuses(updatedStatuses);
      setOpenMenuId(null);
      saveCacheData(effectiveUser.id, {
        animeList,
        watchlist: rawWatchlist,
        statuses: updatedStatuses,
      });
    } catch (error) {
      console.error('Error changing status:', error);
    }
  };

  const tabs = [
    { name: 'Watch Later' as StatusType, icon: <Bookmark className="w-3.5 h-3.5" /> },
    { name: 'Watching' as StatusType, icon: <Clock className="w-3.5 h-3.5" /> },
    { name: 'Completed' as StatusType, icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { name: 'Dropped' as StatusType, icon: <XCircle className="w-3.5 h-3.5" /> },
  ];

  const statusColors = {
    'Watch Later': 'bg-zinc-800 text-zinc-400 border-zinc-700',
    Watching: 'bg-blue-950/30 text-blue-400 border-blue-900/30',
    Completed: 'bg-emerald-950/30 text-emerald-400 border-emerald-900/30',
    Dropped: 'bg-red-950/30 text-red-400 border-red-900/30',
  };

  const statusIcons = {
    'Watch Later': <Bookmark className="w-2.5 h-2.5" />,
    Watching: <Clock className="w-2.5 h-2.5" />,
    Completed: <CheckCircle2 className="w-2.5 h-2.5" />,
    Dropped: <XCircle className="w-2.5 h-2.5" />,
  };

  // ---- RENDER GATES ----
  // Show skeleton while hydrating (prevents login/empty flash)
  if (!hydrated) {
    return <SkeletonPlaceholder />;
  }

  // Not logged in at all
  if (!localUser && !contextUser) {
    return (
      <div className="min-h-screen bg-[#040406] text-zinc-100 flex flex-col items-center justify-center px-4">
        <Bookmark className="w-16 h-16 text-zinc-600 mb-4" />
        <h2 className="text-2xl font-black text-white">Please Login</h2>
        <p className="text-zinc-400 text-sm mt-2 text-center max-w-sm">
          You need to be logged in to view and manage your list.
        </p>
        <button
          onClick={() => {
            if (navigateTo) navigateTo('profile');
            else window.location.href = '/profile';
          }}
          className="mt-6 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-xl transition-colors"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040406] text-zinc-100 font-sans selection:bg-red-600 flex flex-col" suppressHydrationWarning>
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-5 pb-24 md:pb-12">

        {/* PAGE TITLE */}
        <div className="space-y-0.5">
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">My List</h1>
          <p className="text-[11px] md:text-xs text-zinc-500">Track your anime journey</p>
        </div>

        {/* TABS */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none border-b border-zinc-900/40 pb-1">
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.name;
            const count = getTabCount(tab.name);
            return (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] md:text-xs font-bold tracking-wide border transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/20'
                    : 'bg-[#0b0b10]/40 border-zinc-900 text-zinc-500 hover:text-red-400 hover:border-red-500/50'
                }`}
              >
                {tab.icon}
                {tab.name}
                <span className={`text-[9px] ml-0.5 ${isSelected ? 'text-white/70' : 'text-zinc-600'}`}>
                  ({count})
                </span>
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
            className="w-full bg-[#0b0b10] border border-zinc-900 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium placeholder-zinc-600 text-zinc-200 focus:outline-none focus:border-red-500/40 transition-colors"
          />
        </div>

        {/* COUNT */}
        <div className="flex justify-between items-center text-[10px] font-bold px-0.5">
          <span className="text-zinc-500">{activeTab}</span>
          <span className="text-red-500/90 font-medium tracking-wide">
            {dataLoading ? '...' : searchedItems.length}
          </span>
        </div>

        {/* LIST */}
        <div className="space-y-3">
          {dataLoading ? (
            <>
              {[1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
            </>
          ) : searchedItems.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {activeTab === 'Watch Later'
                  ? 'Your list is empty'
                  : `Nothing in ${activeTab}`}
              </p>
              <p className="text-xs mt-1">
                {activeTab === 'Watch Later'
                  ? 'Browse anime and click the bookmark icon to add them here.'
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
                  className="bg-[#0b0b10] border border-zinc-900 p-2.5 rounded-xl md:rounded-2xl flex items-center gap-3.5 hover:border-red-500/20 transition-all group relative"
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
                      className={`absolute top-0 left-2 w-3.5 h-5 rounded-b-xs shadow-md flex items-center justify-center ${
                        status === 'Watching'
                          ? 'bg-blue-600'
                          : status === 'Completed'
                          ? 'bg-emerald-600'
                          : status === 'Dropped'
                          ? 'bg-red-600'
                          : 'bg-red-600'
                      }`}
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
                    <h3 className="text-xs md:text-sm font-bold text-zinc-200 group-hover:text-red-400 transition-colors truncate leading-tight cursor-pointer">
                      {anime.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold text-zinc-500">
                      <span>{anime.type}</span>
                      <span>•</span>
                      <span>{anime.status}</span>
                      <span>•</span>
                      <span className="text-amber-400">★ {anime.score}</span>
                    </div>
                    <div className="pt-0.5">
                      <span
                        className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border flex items-center gap-1 w-fit ${statusColors[status]}`}
                      >
                        {statusIcons[status]}
                        {status}
                      </span>
                    </div>
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
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-red-400 transition-colors p-1.5 rounded-lg"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === item.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-[#16161e] border border-zinc-800 rounded-xl p-1.5 shadow-2xl z-50">
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-3 py-1.5">
                          Move to
                        </p>
                        {tabs.map((tab) => (
                          <button
                            key={tab.name}
                            onClick={(e) => {
                              e.stopPropagation();
                              changeStatus(item.id, tab.name);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold transition-colors ${
                              status === tab.name
                                ? 'bg-red-600/20 text-red-400'
                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                            }`}
                          >
                            {tab.icon}
                            {tab.name}
                            {status === tab.name && (
                              <CheckCircle2 className="w-3 h-3 ml-auto text-red-400" />
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
          className="w-full py-3.5 bg-[#0b0b10] border border-zinc-900 rounded-xl md:rounded-2xl text-[11px] md:text-xs font-black tracking-wide text-zinc-300 hover:border-red-500/30 hover:text-white transition-all flex items-center justify-between px-4 mt-2"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-red-950/30 border border-red-900/30 rounded-md flex items-center justify-center text-red-500">
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