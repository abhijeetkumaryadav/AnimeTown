"use client";

import { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Play, Plus, Flame, ChevronLeft, ChevronRight, Bookmark, X,
  ArrowLeft, Loader2
} from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabaseClient';

// ============================================================
// TYPES
// ============================================================
interface Anime {
  id: string;
  title: string;
  image: string;
  type: string;
  score: number;
  genre: string;
  views?: number;
  description?: string;
  status?: string;
  episodes?: number;
  year?: string;
  studio?: string;
  created_at?: string;
}

interface Episode {
  id: string;
  anime_id: string;
  number: number;
  title: string;
  languages?: Record<string, string>;
  created_at?: string;
}

interface ScheduleItem {
  id: string;
  day: number;
  time: string;
  title: string;
  episode: number;
  anime_id?: string;
}

interface NewsItem {
  id: string;
  title: string;
  content: string;
  image?: string;
  date: string;
  status: string;
  author?: string;
}

// ============================================================
// CACHE HELPERS
// ============================================================
const HOME_CACHE_KEY = 'homeDataCache';

function getCachedHomeData() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(HOME_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveHomeCache(data: {
  animeList: Anime[];
  episodes: Episode[];
  scheduleItems: ScheduleItem[];
  newsItems: NewsItem[];
  featuredIds: string[];
  newlyAddedIds: string[];
}) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HOME_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

function getCachedUserData(userId: string) {
  if (typeof window === 'undefined') return null;
  try {
    const cwRaw = localStorage.getItem(`homeCW_${userId}`);
    const wlRaw = localStorage.getItem(`homeWL_${userId}`);
    return {
      watchHistory: cwRaw ? JSON.parse(cwRaw) : [],
      watchlistIds: wlRaw ? JSON.parse(wlRaw) : [],
    };
  } catch { return null; }
}

function saveUserCache(userId: string, watchHistory: any[], watchlistIds: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`homeCW_${userId}`, JSON.stringify(watchHistory));
    localStorage.setItem(`homeWL_${userId}`, JSON.stringify(watchlistIds));
  } catch {}
}

// ============================================================
// FALLBACK IMAGE
// ============================================================
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=400&q=80";

function getSafeImage(url: string | undefined | null): string {
  if (!url || url.trim() === '') return FALLBACK_IMAGE;
  return url;
}

// ============================================================
// COMPONENTS
// ============================================================

/**
 * FULL‑WIDTH HERO SECTION – fixed height, no resizing
 * - No rounded corners, no border = seamless edge‑to‑edge
 * - Fixed height: h-[360px] on mobile, h-[440px] on md+
 * - Title & description are line‑clamped to prevent expansion
 */
function HeroSection({ anime, onPrev, onNext, onWatch, onToggleList, isInList }: any) {
  return (
    <section className="relative w-full h-[360px] md:h-[440px] overflow-hidden bg-[#0c0d19] shadow-2xl flex items-center">
      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#06070d] via-transparent to-black/20 z-10" />
      <div className="absolute inset-y-0 left-0 w-full md:w-3/5 bg-gradient-to-r from-[#070913] via-[#070913]/95 to-transparent z-10" />
      
      {/* Background image */}
      <div className="absolute right-0 top-0 bottom-0 w-full md:w-1/2 opacity-40 md:opacity-100 z-0">
        <img
          src={getSafeImage(anime?.image)}
          alt="Featured"
          className="w-full h-full object-cover object-right transition-all duration-700"
        />
      </div>

      {/* Navigation arrows (desktop) */}
      <div className="absolute right-6 top-6 z-20 hidden md:flex items-center gap-1.5">
        <button
          onClick={onPrev}
          className="w-7 h-7 bg-black/40 border border-zinc-800 rounded flex items-center justify-center text-zinc-400 hover:text-amber-400 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onNext}
          className="w-7 h-7 bg-black/40 border border-zinc-800 rounded flex items-center justify-center text-zinc-400 hover:text-amber-400 transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="relative pl-6 md:pl-16 pr-6 max-w-xl z-20 space-y-4 w-full">
        <span className="inline-block bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold px-2.5 py-0.5 rounded-md tracking-wider shadow-[0_0_10px_rgba(245,158,11,0.2)]">
          #1 Spotlight
        </span>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white drop-shadow line-clamp-2">
          {anime?.title || "Monogatari Series"}
        </h1>
        <p className="hidden md:block text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md line-clamp-2">
          {anime?.description || "Experience the mind‑bending supernatural world of Monogatari."}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onWatch}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 transition-all text-black text-xs font-bold py-2.5 px-5 rounded-lg shadow-lg shadow-amber-500/20"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Watch Now
          </button>
          <button
            onClick={onToggleList}
            className="p-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-lg text-white hover:bg-zinc-800 hover:border-amber-500/50 transition-all"
          >
            {isInList ? (
              <Bookmark className="w-5 h-5 text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-500 pt-1">
          <span className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">95% Match</span>
          <span className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
            {anime?.type || "TV Series"}
          </span>
          <span className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">16+</span>
        </div>
      </div>
    </section>
  );
}

function GenreFilter({ genres, activeGenre, onSelect, showAll, onToggleShowAll }: any) {
  return (
    <section className="overflow-x-auto flex gap-2 scrollbar-none pb-0.5">
      {genres.map((g: any, i: number) => (
        <button
          key={i}
          onClick={() => { if (g.name === "More") onToggleShowAll(); else onSelect(g.name); }}
          className={`px-3.5 py-1.5 border rounded-md text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
            activeGenre === g.name ? "bg-amber-500 border-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]" : "bg-[#0b0c14] border-zinc-900/80 hover:border-amber-500/50 text-zinc-400 hover:text-amber-400"
          }`}
        >
          <span>{g.icon}</span> {g.name}
        </button>
      ))}
    </section>
  );
}

function AnimeCard({ anime, onPlay, onToggleList, isInList, rank }: any) {
  return (
    <div className="group space-y-1.5 flex-shrink-0 w-[120px] md:w-[150px]">
      <div className="relative aspect-[3/4.2] bg-zinc-900 rounded-lg overflow-hidden border border-zinc-900 group-hover:border-amber-500/30 transition-all cursor-pointer" onClick={onPlay}>
        <img src={getSafeImage(anime.image)} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt={anime.title} />
        {rank ? (
          <span className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-sm font-black px-2.5 py-0.5 rounded-md shadow-lg">
            #{rank}
          </span>
        ) : (
          <span className="absolute top-1 left-1 bg-amber-500 text-black text-[8px] font-black px-1 rounded">TOP</span>
        )}
        <button onClick={(e) => { e.stopPropagation(); onToggleList(); }} className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white/70 hover:text-amber-400 transition-colors z-10">
          <Bookmark className={`w-3 h-3 ${isInList ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]' : ''}`} />
        </button>
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-amber-600 transition-colors">
            <Play className="w-3 h-3 text-black fill-current ml-0.5" />
          </div>
        </div>
      </div>
      <h4 className="text-[11px] font-bold text-zinc-200 truncate group-hover:text-amber-400 cursor-pointer">{anime.title}</h4>
      <div className="flex justify-between text-[10px] text-zinc-500">
        <span>{anime.type}</span>
        <span className="text-amber-400">★ {anime.score}</span>
      </div>
    </div>
  );
}

function EpisodeCard({ episode, anime, onPlay }: any) {
  return (
    <div className="group space-y-1.5 flex-shrink-0 w-[120px] md:w-[150px]">
      <div className="relative aspect-[3/4.2] bg-zinc-900 border border-zinc-900 rounded-lg overflow-hidden group-hover:border-amber-500/30 transition-all cursor-pointer" onClick={onPlay}>
        <img src={getSafeImage(anime?.image)} className="w-full h-full object-cover group-hover:scale-105" alt={anime?.title || "Anime"} />
        <span className="absolute top-1 left-1 bg-blue-600 text-[8px] font-black px-1 rounded text-white">NEW</span>
        <span className="absolute bottom-1 right-1 bg-black/80 text-[8px] font-bold text-zinc-400 px-1 rounded">EP {episode.number}</span>
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-amber-600 transition-colors">
            <Play className="w-3 h-3 text-black fill-current ml-0.5" />
          </div>
        </div>
      </div>
      <h4 className="text-[11px] font-bold text-zinc-200 truncate group-hover:text-amber-400 cursor-pointer">{anime?.title || "Unknown"}</h4>
      <p className="text-[10px] text-zinc-500 truncate">{episode.title || `Episode ${episode.number}`}</p>
    </div>
  );
}

function SectionHeader({ title, icon, onViewAll }: any) {
  return (
    <div className="flex justify-between items-center">
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
        {icon} {title}
      </h3>
      {onViewAll && (
        <button onClick={onViewAll} className="text-[11px] font-semibold text-amber-500 hover:text-amber-400">View all</button>
      )}
    </div>
  );
}

function FullListOverlay({ type, title, items, onClose, onPlay, onToggleList, isInList }: any) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#06070d] overflow-y-auto">
      <div className="max-w-[1400px] mx-auto min-h-screen p-4 md:p-6">
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#06070d] z-10 py-2">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 bg-zinc-900/60 rounded-xl text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-xl font-black text-white">{title}</h2>
          </div>
          <span className="text-xs text-zinc-500">{items.length} items</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {items.map((item: any) => (
            <AnimeCard
              key={item.id}
              anime={item}
              onPlay={() => onPlay(item)}
              onToggleList={() => onToggleList(item)}
              isInList={isInList(item)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN HOMEPAGE COMPONENT
// ============================================================
export default function HomePage() {
  const { user, selectedLanguage } = useApp();
  const router = useRouter();

  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [newlyAddedIds, setNewlyAddedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userDataLoaded, setUserDataLoaded] = useState(false);

  const [rawWatchHistory, setRawWatchHistory] = useState<any[]>([]);
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);

  const [activeGenre, setActiveGenre] = useState('All');
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [popularTypeFilter, setPopularTypeFilter] = useState('All');
  const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState(0);
  const [fullList, setFullList] = useState<{ type: string; title: string } | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  // ---- Instant cache load ----
  useLayoutEffect(() => {
    const cachedHome = getCachedHomeData();
    if (cachedHome) {
      setAnimeList(cachedHome.animeList || []);
      setEpisodes(cachedHome.episodes || []);
      setScheduleItems(cachedHome.scheduleItems || []);
      setNewsItems(cachedHome.newsItems || []);
      setFeaturedIds(cachedHome.featuredIds || []);
      setNewlyAddedIds(cachedHome.newlyAddedIds || []);
      setLoading(false);
    }

    if (user) {
      const cachedUser = getCachedUserData(user.id);
      if (cachedUser) {
        setRawWatchHistory(cachedUser.watchHistory || []);
        setWatchlistIds(cachedUser.watchlistIds || []);
        setUserDataLoaded(true);
      }
    }
  }, [user]);

  // ---- Background API fetch ----
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [animeRes, episodesRes, scheduleRes, newsRes, featuredRes, newlyAddedRes] =
          await Promise.all([
            fetch('/api/anime').then(r => r.json()),
            fetch('/api/episodes').then(r => r.json()),
            fetch('/api/schedule').then(r => r.json()),
            fetch('/api/news').then(r => r.json()),
            fetch('/api/featured').then(r => r.json()),
            fetch('/api/newly-added').then(r => r.json()),
          ]);
        const freshAnime = animeRes.anime || [];
        const freshEpisodes = episodesRes.episodes || [];
        const freshSchedule = scheduleRes.schedule || [];
        const freshNews = newsRes.news || [];
        const freshFeatured = featuredRes.featured || [];
        const freshNewlyAdded = newlyAddedRes.newlyAdded || [];

        setAnimeList(freshAnime);
        setEpisodes(freshEpisodes);
        setScheduleItems(freshSchedule);
        setNewsItems(freshNews);
        setFeaturedIds(freshFeatured);
        setNewlyAddedIds(freshNewlyAdded);

        saveHomeCache({
          animeList: freshAnime,
          episodes: freshEpisodes,
          scheduleItems: freshSchedule,
          newsItems: freshNews,
          featuredIds: freshFeatured,
          newlyAddedIds: freshNewlyAdded,
        });
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ---- Fetch user data from Supabase ----
  useEffect(() => {
    if (!user) {
      setRawWatchHistory([]);
      setWatchlistIds([]);
      setUserDataLoaded(true);
      return;
    }

    const fetchUserData = async () => {
      try {
        const cachedUser = getCachedUserData(user.id);
        const hasCache = cachedUser && (cachedUser.watchHistory.length > 0 || cachedUser.watchlistIds.length > 0);

        const { data: watchData } = await supabase
          .from('watch_history')
          .select('anime_id, last_episode, updated_at, progress')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(10);

        const { data: bookmarks } = await supabase
          .from('bookmarks')
          .select('anime_id')
          .eq('user_id', user.id);

        const historyRows = watchData || [];
        const wlIds = bookmarks ? bookmarks.map(b => b.anime_id) : [];

        if (historyRows.length === 0 && wlIds.length === 0 && hasCache) {
          setUserDataLoaded(true);
          return;
        }

        if (historyRows.length > 0 || wlIds.length > 0) {
          setRawWatchHistory(historyRows);
          setWatchlistIds(wlIds);
          saveUserCache(user.id, historyRows, wlIds);
        }

        setUserDataLoaded(true);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setUserDataLoaded(true);
      }
    };

    fetchUserData();
  }, [user]);

  // ---- Auto‑refresh on tab focus ----
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const refreshUserData = async () => {
          try {
            const cachedUser = getCachedUserData(user.id);
            const hasCache = cachedUser && (cachedUser.watchHistory.length > 0 || cachedUser.watchlistIds.length > 0);

            const { data: watchData } = await supabase
              .from('watch_history')
              .select('anime_id, last_episode, updated_at, progress')
              .eq('user_id', user.id)
              .order('updated_at', { ascending: false })
              .limit(10);

            const { data: bookmarks } = await supabase
              .from('bookmarks')
              .select('anime_id')
              .eq('user_id', user.id);

            const historyRows = watchData || [];
            const wlIds = bookmarks ? bookmarks.map(b => b.anime_id) : [];

            if (historyRows.length === 0 && wlIds.length === 0 && hasCache) {
              return;
            }

            if (historyRows.length > 0 || wlIds.length > 0) {
              setRawWatchHistory(historyRows);
              setWatchlistIds(wlIds);
              saveUserCache(user.id, historyRows, wlIds);
            }
            setUserDataLoaded(true);
          } catch (error) {
            console.error('Error refreshing user data:', error);
          }
        };

        refreshUserData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

  // ---- Derived data ----
  const continueWatching = useMemo(() => {
    if (!userDataLoaded || animeList.length === 0) return [];
    return rawWatchHistory
      .map(w => {
        const anime = animeList.find(a => a.id === w.anime_id);
        if (!anime) return null;
        return {
          animeId: w.anime_id,
          animeTitle: anime.title,
          animeImage: getSafeImage(anime.image),
          epNumber: w.last_episode || 1,
          progress: w.progress || 0,
        };
      })
      .filter(Boolean) as any[];
  }, [rawWatchHistory, animeList, userDataLoaded]);

  const watchlistItems = useMemo(() => {
    if (!userDataLoaded || animeList.length === 0) return [];
    return watchlistIds
      .map(id => {
        const anime = animeList.find(a => a.id === id);
        if (!anime) return null;
        return { ...anime, image: getSafeImage(anime.image) };
      })
      .filter(Boolean) as Anime[];
  }, [watchlistIds, animeList, userDataLoaded]);

  // ---- Auto-rotate banner ----
  useEffect(() => {
    if (featuredIds.length === 0) return;
    const interval = setInterval(() => {
      setCurrentFeaturedIndex(prev => (prev + 1) % featuredIds.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [featuredIds]);

  // ---- Language filtering ----
  const episodesWithLang = selectedLanguage === 'all'
    ? episodes
    : episodes.filter(ep => ep.languages && ep.languages[selectedLanguage] && ep.languages[selectedLanguage].trim() !== '');
  const animeIdsWithLang = new Set(episodesWithLang.map(ep => ep.anime_id));
  const filteredAnimeList = selectedLanguage === 'all'
    ? animeList
    : animeList.filter(a => animeIdsWithLang.has(a.id));
  const displayAnime = filteredAnimeList.length > 0 ? filteredAnimeList : animeList;

  const allGenres = [...new Set(displayAnime.flatMap(a => (a.genre || '').split(',').map(g => g.trim())).filter(Boolean))].sort();
  const initialGenres = [
    { name: "All", icon: "✨" },
    ...allGenres.slice(0, 8).map(g => ({ name: g, icon: '📌' })),
    { name: "More", icon: "•••" }
  ];
  const extendedGenres = [
    { name: "All", icon: "✨" },
    ...allGenres.map(g => ({ name: g, icon: '📌' })),
  ];
  const displayedGenres = showAllGenres ? extendedGenres : initialGenres;

  const genreFiltered = activeGenre === 'All'
    ? displayAnime
    : displayAnime.filter(a => (a.genre || '').toLowerCase().includes(activeGenre.toLowerCase()));

  const newlyAdded = useMemo(() => {
    if (newlyAddedIds.length > 0) {
      return newlyAddedIds
        .map(id => genreFiltered.find(a => a.id === id))
        .filter(Boolean) as Anime[];
    }
    return [...genreFiltered]
      .filter(a => a.created_at)
      .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
      .slice(0, 10);
  }, [genreFiltered, newlyAddedIds]);

  const topRated = useMemo(() => {
    return [...genreFiltered]
      .filter(a => (a.score || 0) >= 7)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 12);   // changed from 6 to 12
  }, [genreFiltered]);

  const trendingAnime = useMemo(() => {
    return [...genreFiltered].sort((a, b) => (parseInt(b.id) - parseInt(a.id)));
  }, [genreFiltered]);

  const uniqueTypes = [...new Set(displayAnime.map(a => a.type).filter(Boolean))];

  const popularAnime = useMemo(() => {
    return (popularTypeFilter === 'All'
      ? genreFiltered
      : genreFiltered.filter(a => a.type === popularTypeFilter)
    ).sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [genreFiltered, popularTypeFilter]);

  const featuredAnime = featuredIds.length > 0
    ? animeList.find(a => a.id === featuredIds[currentFeaturedIndex % featuredIds.length])
    : (displayAnime.length > 0 ? displayAnime[0] : null);

  const latestEpisodes = useMemo(() => {
    const filtered = episodesWithLang.filter(ep => displayAnime.some(a => a.id === ep.anime_id));
    return filtered.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (dateA && dateB) return dateB - dateA;
      return (parseInt(b.id) - parseInt(a.id));
    }).slice(0, 12);   // changed from 10 to 12
  }, [episodesWithLang, displayAnime]);

  const publishedNews = newsItems.filter(n => n.status === 'published').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const mostWatched = [...displayAnime].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
  const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const fullListItems = useMemo(() => {
    if (!fullList) return [];
    switch (fullList.type) {
      case 'updates':
        return latestEpisodes.map(ep => {
          const anime = displayAnime.find(a => a.id === ep.anime_id);
          return { ...ep, ...anime };
        });
      case 'popular':
        return popularAnime;
      case 'trending':
        return trendingAnime;
      case 'newlyAdded':
        return newlyAdded;
      case 'topRated':
        return topRated;
      default:
        return trendingAnime;
    }
  }, [fullList, latestEpisodes, displayAnime, popularAnime, trendingAnime, newlyAdded, topRated]);

  // ---- Handlers ----
  const toggleWatchlist = async (anime: any) => {
    if (!user) {
      alert('Please login to add to watchlist!');
      return;
    }
    const exists = watchlistIds.includes(anime.id);
    let updatedIds;
    if (exists) {
      updatedIds = watchlistIds.filter(id => id !== anime.id);
      await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('anime_id', anime.id);
    } else {
      updatedIds = [...watchlistIds, anime.id];
      await supabase.from('bookmarks').insert({ user_id: user.id, anime_id: anime.id });
    }
    setWatchlistIds(updatedIds);
    saveUserCache(user.id, rawWatchHistory, updatedIds);
  };

  const isInList = (anime: any) => watchlistIds.includes(anime.id);
  const goToPrevHero = () => {
    if (featuredIds.length === 0) return;
    setCurrentFeaturedIndex(prev => (prev - 1 + featuredIds.length) % featuredIds.length);
  };
  const goToNextHero = () => {
    if (featuredIds.length === 0) return;
    setCurrentFeaturedIndex(prev => (prev + 1) % featuredIds.length);
  };
  const handlePlay = (anime: any) => {
    router.push(`/watch?anime=${anime.id}`);
  };
  const goToWatchHistory = () => router.push('/profile?tab=Watch%20History');
  const goToMyList = () => router.push('/profile?tab=My%20List');
  const handleNewsClick = (news: NewsItem) => setSelectedNews(news);
  const handleCloseNews = () => setSelectedNews(null);

  // ---- Skeleton ----
  if (loading && !animeList.length) {
    return (
      <div className="max-w-[1400px] mx-auto w-full px-4 md:px-6 py-5 space-y-6">
        <div className="h-80 bg-zinc-900 rounded-2xl animate-pulse" />
        <div className="flex gap-2 overflow-x-auto">
          {[1,2,3,4,5,6,7].map(i => <div key={i} className="h-8 w-20 bg-zinc-900 rounded-full animate-pulse" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 bg-zinc-900 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  // ---- News Detail Overlay ----
  if (selectedNews) {
    return (
      <div className="min-h-screen bg-[#040406] text-zinc-100 font-sans selection:bg-amber-500 flex flex-col">
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6 pb-24 md:pb-12">
          <button
            onClick={handleCloseNews}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-bold">Back to Home</span>
          </button>
          <div className="bg-[#0d0d14] border border-zinc-900 rounded-2xl overflow-hidden">
            {selectedNews.image && (
              <div className="w-full aspect-video bg-zinc-900 overflow-hidden">
                <img src={getSafeImage(selectedNews.image)} alt={selectedNews.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6 md:p-10 space-y-4">
              <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                <span>{selectedNews.date || 'Just now'}</span>
                {selectedNews.author && (
                  <>
                    <span className="text-zinc-700">•</span>
                    <span>{selectedNews.author}</span>
                  </>
                )}
              </div>
              <h1 className="text-2xl md:text-4xl font-black text-white leading-tight">{selectedNews.title}</h1>
              <div className="prose prose-invert prose-sm md:prose-base max-w-none text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {selectedNews.content}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ---- Main Dashboard ----
  return (
    <>
      {/* Full List Overlay */}
      {fullList && (
        <FullListOverlay
          type={fullList.type}
          title={fullList.title}
          items={fullListItems}
          onClose={() => setFullList(null)}
          onPlay={handlePlay}
          onToggleList={toggleWatchlist}
          isInList={isInList}
        />
      )}

      {/* ===== FULL‑WIDTH HERO (outside max‑width container) ===== */}
      <HeroSection
        anime={featuredAnime}
        onPrev={goToPrevHero}
        onNext={goToNextHero}
        onWatch={() => featuredAnime && handlePlay(featuredAnime)}
        onToggleList={() => featuredAnime && toggleWatchlist(featuredAnime)}
        isInList={featuredAnime ? isInList(featuredAnime) : false}
      />

      {/* Everything else inside the max‑width container */}
      <div className="max-w-[1400px] mx-auto w-full px-0 md:px-6 py-5 space-y-6">
        {/* Genre Filter */}
        <div className="px-4 md:px-0">
          <GenreFilter
            genres={displayedGenres}
            activeGenre={activeGenre}
            onSelect={setActiveGenre}
            showAll={showAllGenres}
            onToggleShowAll={() => setShowAllGenres(!showAllGenres)}
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          <div className="w-full lg:w-[70%] flex flex-col gap-6">
            
            {/* Newly Added – 7 items */}
            <section className="space-y-3 px-4 md:px-0 md:bg-[#0a0b12] md:border md:border-zinc-900/60 md:rounded-xl p-0 md:p-4">
              <SectionHeader
                title="Newly Added"
                icon="🆕"
                onViewAll={() => setFullList({ type: 'newlyAdded', title: 'Newly Added' })}
              />
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
                {newlyAdded.slice(0, 7).map((anime, index) => (
                  <AnimeCard
                    key={anime.id}
                    anime={anime}
                    rank={index + 1}
                    onPlay={() => handlePlay(anime)}
                    onToggleList={() => toggleWatchlist(anime)}
                    isInList={isInList(anime)}
                  />
                ))}
              </div>
            </section>

            {/* Trending – 12 items */}
            <section className="space-y-3 px-4 md:px-0 md:bg-[#0a0b12] md:border md:border-zinc-900/60 md:rounded-xl p-0 md:p-4">
              <SectionHeader
                title={`Trending Now ${activeGenre !== 'All' ? `in ${activeGenre}` : ''}`}
                icon={<Flame className="w-3.5 h-3.5 text-amber-500" />}
                onViewAll={() => setFullList({ type: 'trending', title: 'Trending Now' })}
              />
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
                {trendingAnime.slice(0, 12).map(anime => (
                  <AnimeCard
                    key={anime.id}
                    anime={anime}
                    onPlay={() => handlePlay(anime)}
                    onToggleList={() => toggleWatchlist(anime)}
                    isInList={isInList(anime)}
                  />
                ))}
              </div>
            </section>

            {/* Latest Updates – 12 items */}
            <section className="space-y-3 px-4 md:px-0 md:bg-[#0a0b12] md:border md:border-zinc-900/60 md:rounded-xl p-0 md:p-4">
              <SectionHeader
                title="Latest Updates"
                icon="⚡"
                onViewAll={() => setFullList({ type: 'updates', title: 'Latest Updates' })}
              />
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
                {latestEpisodes.slice(0, 12).map(ep => {
                  const anime = displayAnime.find(a => a.id === ep.anime_id);
                  return (
                    <EpisodeCard
                      key={ep.id}
                      episode={ep}
                      anime={anime}
                      onPlay={() => anime && handlePlay(anime)}
                    />
                  );
                })}
              </div>
            </section>

            {/* Popular Shows – 12 items */}
            <section className="space-y-3 px-4 md:px-0 md:bg-[#0a0b12] md:border md:border-zinc-900/60 md:rounded-xl p-0 md:p-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-1 border-b border-zinc-900/40">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  ⭐ Popular Shows {activeGenre !== 'All' && `- ${activeGenre}`}
                </h3>
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                  <div className="flex items-center gap-1 bg-black/40 p-0.5 border border-zinc-900 rounded-md">
                    {["All", ...uniqueTypes].map(f => (
                      <button
                        key={f}
                        onClick={() => setPopularTypeFilter(f)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded transition-all duration-200 ${
                          popularTypeFilter === f ? "bg-amber-500 text-black shadow-[0_0_6px_rgba(245,158,11,0.3)]" : "text-zinc-500 hover:text-amber-400"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
                {popularAnime.slice(0, 12).map(anime => (
                  <AnimeCard
                    key={anime.id}
                    anime={anime}
                    onPlay={() => handlePlay(anime)}
                    onToggleList={() => toggleWatchlist(anime)}
                    isInList={isInList(anime)}
                  />
                ))}
              </div>
            </section>

            {/* Top Rated – 12 items */}
            <section className="space-y-3 px-4 md:px-0 md:bg-[#0a0b12] md:border md:border-zinc-900/60 md:rounded-xl p-0 md:p-4">
              <SectionHeader
                title="Top Rated"
                icon="🏆"
                onViewAll={() => setFullList({ type: 'topRated', title: 'Top Rated' })}
              />
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
                {topRated.slice(0, 12).map(anime => (
                  <AnimeCard
                    key={anime.id}
                    anime={anime}
                    onPlay={() => handlePlay(anime)}
                    onToggleList={() => toggleWatchlist(anime)}
                    isInList={isInList(anime)}
                  />
                ))}
              </div>
            </section>

            {/* Most Watched + Schedule Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 md:px-0">
              <div className="space-y-3 md:bg-[#0a0b12] md:border md:border-zinc-900/60 md:rounded-xl p-0 md:p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">📊 Most Watched</h3>
                <div className="flex flex-col gap-2">
                  {mostWatched.map((anime, idx) => (
                    <div key={anime.id} className="flex items-center gap-3 bg-[#0d0e1a]/40 p-2 rounded-lg hover:border-amber-500/30 group cursor-pointer" onClick={() => handlePlay(anime)}>
                      <span className="text-sm font-black text-zinc-600 group-hover:text-amber-500 w-5">{String(idx+1).padStart(2,'0')}</span>
                      <img src={getSafeImage(anime.image)} className="w-9 h-9 object-cover rounded-md" alt={anime.title} />
                      <div className="min-w-0 flex-1"><h4 className="text-[11px] font-bold truncate">{anime.title}</h4></div>
                      <span className="text-[10px] text-amber-400">★ {anime.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden md:block space-y-3 md:bg-[#0a0b12] md:border md:border-zinc-900/60 md:rounded-xl p-0 md:p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">📅 Weekly Schedule</h3>
                <div className="flex flex-col gap-2">
                  {scheduleItems.slice(0, 5).map(item => {
                    const anime = displayAnime.find(a => a.id === item.anime_id);
                    return (
                      <div key={item.id} className="flex items-center gap-3 bg-[#0d0e1a]/40 p-2 rounded-lg">
                        <div className="w-10 h-10 bg-amber-500 rounded flex flex-col items-center justify-center text-black shadow">
                          <span className="text-[7px] font-bold">{DAYS_SHORT[item.day]}</span>
                          <span className="text-xs font-black">{item.time.split(':')[0]}</span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-[11px] font-bold truncate">{anime?.title || item.title}</h4>
                          <p className="text-[9px] text-zinc-500">Episode {item.episode}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ==================== MOBILE ONLY SECTIONS ==================== */}
            <div className="block md:hidden space-y-6">
              
              {/* Continue Watching */}
              <section className="space-y-3 px-4">
                <SectionHeader
                  title="Continue Watching"
                  icon="📺"
                  onViewAll={goToWatchHistory}
                />
                <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
                  {!user ? (
                    <div className="text-xs text-zinc-500 py-4 w-full text-center">
                      <button onClick={() => router.push('/profile')} className="text-amber-400 hover:underline">
                        Login
                      </button> to see your continue watching.
                    </div>
                  ) : !userDataLoaded || animeList.length === 0 ? (
                    <div className="text-xs text-zinc-500 py-4 w-full text-center flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> Loading...
                    </div>
                  ) : continueWatching.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 w-full text-center">Start watching an episode to see it here.</p>
                  ) : (
                    continueWatching.map((item, i) => (
                      <div key={i} className="flex-shrink-0 w-[140px] space-y-1.5 cursor-pointer" onClick={() => handlePlay({ id: item.animeId })}>
                        <div className="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden">
                          <img src={item.animeImage} className="w-full h-full object-cover opacity-80" alt="" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Play className="w-5 h-5 text-white fill-current" />
                          </div>
                        </div>
                        <h4 className="text-[11px] font-bold text-zinc-200 truncate">{item.animeTitle}</h4>
                        <p className="text-[9px] text-zinc-500">EP {item.epNumber}</p>
                        <div className="h-1 bg-zinc-900 rounded-full">
                          <div className="h-full bg-amber-500" style={{ width: `${item.progress}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* My Watchlist */}
              <section className="space-y-3 px-4">
                <SectionHeader
                  title="My Watchlist"
                  icon="🔖"
                  onViewAll={goToMyList}
                />
                <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
                  {!user ? (
                    <div className="text-xs text-zinc-500 py-4 w-full text-center">
                      <button onClick={() => router.push('/profile')} className="text-amber-400 hover:underline">
                        Login
                      </button> to add bookmarks.
                    </div>
                  ) : !userDataLoaded || animeList.length === 0 ? (
                    <div className="text-xs text-zinc-500 py-4 w-full text-center flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> Loading...
                    </div>
                  ) : watchlistItems.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 w-full text-center">Bookmark anime to see them here.</p>
                  ) : (
                    watchlistItems.map((item) => (
                      <div key={item.id} className="flex-shrink-0 w-[100px] space-y-1 cursor-pointer" onClick={() => handlePlay(item)}>
                        <div className="relative aspect-[3/4] bg-zinc-900 rounded-lg overflow-hidden border border-zinc-900">
                          <img src={item.image} className="w-full h-full object-cover" alt="" />
                        </div>
                        <h4 className="text-[10px] font-bold text-zinc-200 truncate">{item.title}</h4>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Anime News – 5 items for mobile */}
              <section className="space-y-3 px-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">📰 Anime News</h3>
                <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
                  {publishedNews.slice(0, 5).map((n) => (
                    <div key={n.id} onClick={() => handleNewsClick(n)} className="flex-shrink-0 w-[220px] bg-[#0d0e1a]/40 border border-zinc-900/60 p-3 rounded-xl flex gap-3 cursor-pointer hover:border-amber-500/30 transition-all">
                      {n.image && <img src={getSafeImage(n.image)} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[11px] font-bold text-zinc-200 line-clamp-2">{n.title}</h4>
                        <p className="text-[9px] text-zinc-400 mt-1 line-clamp-2">{n.content}</p>
                        <p className="text-[8px] text-zinc-600 mt-1">{n.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recommended */}
              <section className="space-y-3 px-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">🎯 Recommended for You</h3>
                <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
                  {trendingAnime.slice(0, 4).map(anime => (
                    <AnimeCard
                      key={anime.id}
                      anime={anime}
                      onPlay={() => handlePlay(anime)}
                      onToggleList={() => toggleWatchlist(anime)}
                      isInList={isInList(anime)}
                    />
                  ))}
                </div>
              </section>
            </div>
            {/* ==================== END MOBILE ONLY SECTIONS ==================== */}
          </div>

          {/* ==================== DESKTOP SIDEBAR ==================== */}
          <div className="hidden lg:flex lg:w-[30%] flex-col gap-5 sticky top-20">
            
            {/* Continue Watching */}
            <div className="bg-[#0a0b12] border border-zinc-900/60 rounded-xl p-4 space-y-3">
              <SectionHeader
                title="Continue Watching"
                icon="📺"
                onViewAll={goToWatchHistory}
              />
              {!user ? (
                <div className="text-xs text-zinc-500 py-4 text-center">
                  <button onClick={() => router.push('/profile')} className="text-amber-400 hover:underline">
                    Login
                  </button> to see your continue watching.
                </div>
              ) : !userDataLoaded || animeList.length === 0 ? (
                <div className="text-xs text-zinc-500 py-4 text-center flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> Loading...
                </div>
              ) : continueWatching.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">Start watching an episode.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {continueWatching.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 group cursor-pointer" onClick={() => handlePlay({ id: item.animeId })}>
                      <div className="relative w-16 h-10 bg-zinc-900 rounded-md overflow-hidden border border-zinc-900 shrink-0">
                        <img src={item.animeImage} className="w-full h-full object-cover opacity-80" alt="" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40">
                          <Play className="w-2.5 h-2.5 text-white fill-current" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <h4 className="text-[11px] font-bold truncate text-zinc-200">{item.animeTitle}</h4>
                        <p className="text-[9px] text-zinc-500">EP {item.epNumber}</p>
                        <div className="relative w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${item.progress}%` }} />
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-zinc-500 shrink-0">
                        {item.progress}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My Watchlist */}
            <div className="bg-[#0a0b12] border border-zinc-900/60 rounded-xl p-4 space-y-3">
              <SectionHeader
                title="My Watchlist"
                icon="🔖"
                onViewAll={goToMyList}
              />
              {!user ? (
                <div className="text-xs text-zinc-500 py-4 text-center">
                  <button onClick={() => router.push('/profile')} className="text-amber-400 hover:underline">
                    Login
                  </button> to add bookmarks.
                </div>
              ) : !userDataLoaded || animeList.length === 0 ? (
                <div className="text-xs text-zinc-500 py-4 text-center flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> Loading...
                </div>
              ) : watchlistItems.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">Bookmark anime to add them here.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {watchlistItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 group">
                      <div className="flex items-center gap-3 min-w-0 cursor-pointer flex-1" onClick={() => handlePlay(item)}>
                        <img src={item.image} className="w-8 h-8 object-cover rounded border border-zinc-900 shrink-0" alt="" />
                        <h4 className="text-[11px] font-bold truncate text-zinc-300">{item.title}</h4>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); toggleWatchlist(item); }} className="text-zinc-500 hover:text-amber-500 shrink-0">
                        <Bookmark className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Anime News (desktop stays 3) */}
            <div className="bg-[#0a0b12] border border-zinc-900/60 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">📰 Anime News</h3>
              <div className="flex flex-col gap-3">
                {publishedNews.slice(0, 3).map((n) => (
                  <div key={n.id} onClick={() => handleNewsClick(n)} className="space-y-0.5 border-l-2 border-zinc-800 hover:border-amber-500 pl-2.5 py-0.5 cursor-pointer group">
                    <h4 className="text-[11px] font-bold text-zinc-200 group-hover:text-amber-400 leading-tight">{n.title}</h4>
                    <p className="text-[10px] text-zinc-400 truncate">{n.content?.substring(0, 60)}</p>
                    <p className="text-[9px] text-zinc-600">{n.date}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* ==================== END DESKTOP SIDEBAR ==================== */}
        </div>
      </div>
    </>
  );
}