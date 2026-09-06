"use client";

import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Play, Plus, Flame, ChevronLeft, ChevronRight, Bookmark, X,
  ArrowLeft, Loader2, ChevronDown, Check, ArrowUp
} from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabaseClient';
import { CloudflareAPI } from '@/lib/db-client';

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
// TYPE NORMALIZATION
// ============================================================
function normalizeType(type: string | undefined | null): string {
  if (!type) return '';
  const upper = type.toUpperCase().trim();
  if (['TV', 'TV_SHOW', 'TV_SERIES'].includes(upper)) return 'TV';
  if (['MOVIE', 'FILM'].includes(upper)) return 'Movie';
  if (['OVA', 'OAV'].includes(upper)) return 'OVA';
  if (['ONA'].includes(upper)) return 'ONA';
  if (['SPECIAL', 'SP'].includes(upper)) return 'Special';
  if (['TV_SHORT', 'TV_SHORT'].includes(upper)) return 'TV Short';
  return upper.charAt(0) + upper.slice(1).toLowerCase();
}

// ============================================================
// LIGHTWEIGHT FALLBACK
// ============================================================
const FALLBACK_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280" width="200" height="280">
    <rect width="200" height="280" fill="#1a1a2e"/>
    <rect x="35" y="45" width="130" height="95" rx="5" fill="#1f1f2e" stroke="#ef4444" stroke-width="2.5"/>
    <rect x="80" y="140" width="40" height="12" rx="2" fill="#ef4444"/>
    <line x1="100" y1="140" x2="100" y2="118" stroke="#ef4444" stroke-width="2.5"/>
    <circle cx="100" cy="92" r="22" fill="none" stroke="#ef4444" stroke-width="2"/>
    <polygon points="82,92 118,80 118,104" fill="#ef4444" opacity="0.25"/>
    <text x="100" y="178" font-family="Arial, sans-serif" font-size="11" fill="#555" text-anchor="middle">No Preview</text>
  </svg>`
)}`;

function getSafeImage(url: string | undefined | null): string {
  if (!url || url.trim() === '') return FALLBACK_IMAGE;
  return url;
}

// ============================================================
// SKELETON
// ============================================================
const CarouselSkeleton = ({ count = 7 }: { count?: number }) => (
  <div className="flex gap-3 overflow-x-auto pb-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex-shrink-0 w-[110px] md:w-[150px] space-y-2">
        <div className="aspect-[3/4.2] bg-zinc-800 rounded-lg animate-pulse" />
        <div className="h-3 bg-zinc-800 rounded w-3/4 animate-pulse" />
        <div className="h-2 bg-zinc-800 rounded w-1/2 animate-pulse" />
      </div>
    ))}
  </div>
);

// ============================================================
// FULL LIST OVERLAY – now handles both AnimeCard and EpisodeCard
// ============================================================
function FullListOverlay({
  type,
  title,
  items,
  onClose,
  onPlay,
  onToggleList,
  isInList,
  initialCount = 50,
  batchSize = 50,
}: any) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setVisibleCount(Math.min(initialCount, items.length));
  }, [items, initialCount]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  const loadMore = async () => {
    setLoadingMore(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    setVisibleCount((prev: number) => Math.min(prev + batchSize, items.length));
    setLoadingMore(false);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#0d0e1a] rounded-2xl w-full max-w-7xl max-h-[90vh] flex flex-col shadow-2xl border border-white/10 animate-slideUp">
        <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg md:text-xl font-bold text-white">{title}</h2>
          </div>
          <span className="text-xs font-medium text-zinc-400 bg-white/5 px-3 py-1 rounded-full">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {visibleItems.map((item: any) => {
              // If the item has an episode number, render EpisodeCard
              if (item.number !== undefined && item._anime) {
                return (
                  <EpisodeCard
                    key={item.id}
                    episode={item}
                    anime={item._anime}
                    onPlay={() => onPlay(item)}
                  />
                );
              }
              // Otherwise render AnimeCard
              return (
                <AnimeCard
                  key={item.id}
                  anime={item}
                  onPlay={() => onPlay(item)}
                  onToggleList={() => onToggleList(item)}
                  isInList={isInList(item)}
                />
              );
            })}
          </div>

          <div className="mt-8 flex justify-center">
            {hasMore ? (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-zinc-300 hover:text-white transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  `Load More (${visibleCount}/${items.length})`
                )}
              </button>
            ) : items.length > 0 ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Check className="w-4 h-4 text-emerald-400" />
                All {items.length} items loaded
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No items to show</p>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}

// ============================================================
// MEMOIZED COMPONENTS
// ============================================================
const HeroSection = React.memo(function HeroSection({ anime, index, total, onPrev, onNext, onWatch, onToggleList, isInList }: any) {
  const [expanded, setExpanded] = useState(false);
  const description = anime?.description || "No description available.";
  const isLongDescription = description.length > 120;
  const truncatedDesc = isLongDescription ? description.slice(0, 120) + '...' : description;
  const [imgError, setImgError] = useState(false);

  if (!anime) {
    return (
      <section className="relative w-full h-[300px] md:h-[440px] overflow-hidden bg-[#0c0d19] shadow-2xl flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-t from-[#06070d] via-transparent to-black/20 z-10" />
        <div className="relative z-20 text-center text-zinc-400 px-6">
          <div className="text-5xl md:text-7xl mb-4">🎌</div>
          <p className="text-lg md:text-2xl font-bold text-white">No featured anime available</p>
          <p className="text-sm md:text-base text-zinc-500 mt-2 max-w-md mx-auto">
            We're currently updating our spotlight selection. Please check back later or try refreshing the page.
          </p>
        </div>
      </section>
    );
  }

  const spotlightNumber = index !== undefined && index !== null ? index + 1 : 1;
  const toggleExpand = () => setExpanded(!expanded);

  return (
    <section className="relative w-full h-[300px] md:h-[440px] overflow-hidden bg-[#0c0d19] shadow-2xl flex items-center">
      <div className="absolute inset-0 bg-gradient-to-t from-[#06070d] via-transparent to-black/20 z-10" />
      <div className="absolute inset-y-0 left-0 w-full md:w-3/5 bg-gradient-to-r from-[#070913] via-[#070913]/95 to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-full md:w-1/2 opacity-40 md:opacity-100 z-0">
        <Image
          src={imgError ? FALLBACK_IMAGE : getSafeImage(anime.image)}
          alt="Featured"
          fill
          className="object-cover object-right transition-all duration-700"
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          onError={() => setImgError(true)}
          unoptimized
        />
      </div>
      <div className="absolute right-6 top-6 z-20 hidden md:flex items-center gap-1.5">
        <button onClick={onPrev} className="w-7 h-7 bg-black/40 border border-zinc-800 rounded flex items-center justify-center text-zinc-400 hover:text-amber-400 transition-all" aria-label="Previous slide">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={onNext} className="w-7 h-7 bg-black/40 border border-zinc-800 rounded flex items-center justify-center text-zinc-400 hover:text-amber-400 transition-all" aria-label="Next slide">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="relative pl-5 md:pl-16 pr-5 max-w-xl z-20 space-y-3 w-full">
        <span className="inline-block bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wider shadow-[0_0_10px_rgba(245,158,11,0.2)]">
          #{spotlightNumber} Spotlight
        </span>
        <h1 className="text-xl md:text-4xl font-black tracking-tight leading-tight text-white drop-shadow line-clamp-2">{anime.title}</h1>
        <div className="hidden md:block">
          <div className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md transition-all duration-300 overflow-hidden" style={{ maxHeight: expanded ? '500px' : '3.6rem' }}>
            {expanded ? description : truncatedDesc}
          </div>
          {isLongDescription && (
            <button onClick={toggleExpand} className="text-amber-400 text-xs font-semibold hover:text-amber-300 transition-colors mt-1 flex items-center gap-1" aria-label={expanded ? 'Show less' : 'Show more'}>
              {expanded ? 'Show less' : 'more...'}
              <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <button onClick={onWatch} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 transition-all text-black text-[11px] md:text-xs font-bold py-2 px-4 rounded-lg shadow-lg shadow-amber-500/20" aria-label="Watch now">
            <Play className="w-3.5 h-3.5 fill-current" /> Watch Now
          </button>
          <button onClick={onToggleList} className="p-2 bg-zinc-900/60 border border-zinc-800/80 rounded-lg text-white hover:bg-zinc-800 hover:border-amber-500/50 transition-all" aria-label={isInList ? 'Remove from watchlist' : 'Add to watchlist'}>
            {isInList ? <Bookmark className="w-4 h-4 text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-semibold text-zinc-500 pt-0.5 flex-wrap">
          <span className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">95% Match</span>
          <span className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">{anime.type || "TV Series"}</span>
          <span className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">16+</span>
        </div>
      </div>
    </section>
  );
});

const GenreFilter = React.memo(function GenreFilter({ genres, activeGenre, onSelect, showAll, onToggleShowAll }: any) {
  return (
    <section className="overflow-x-auto flex gap-1.5 md:gap-2 scrollbar-none pb-0.5 px-0">
      {genres.map((g: any, i: number) => (
        <button
          key={i}
          onClick={() => { if (g.name === "More") onToggleShowAll(); else onSelect(g.name); }}
          className={`px-2.5 md:px-3.5 py-1 md:py-1.5 border rounded-md text-[10px] md:text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1 ${
            activeGenre === g.name ? "bg-amber-500 border-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]" : "bg-[#0b0c14] border-zinc-900/80 hover:border-amber-500/50 text-zinc-400 hover:text-amber-400"
          }`}
          aria-label={`Filter by ${g.name}`}
        >
          <span className="text-xs md:text-base">{g.icon}</span> <span className="hidden md:inline">{g.name}</span>
          <span className="md:hidden">{g.name === "All" ? "All" : g.name === "More" ? "More" : g.name.substring(0, 6)}</span>
        </button>
      ))}
    </section>
  );
});

const AnimeCard = React.memo(function AnimeCard({ anime, onPlay, onToggleList, isInList, rank }: any) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="group space-y-1 flex-shrink-0 w-[110px] md:w-[150px]">
      <div className="relative aspect-[3/4.2] bg-zinc-900 rounded-lg overflow-hidden border border-zinc-900 group-hover:border-amber-500/30 transition-all cursor-pointer" onClick={onPlay}>
        <Image
          src={imgError ? FALLBACK_IMAGE : getSafeImage(anime.image)}
          alt={anime.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform"
          loading="lazy"
          onError={() => setImgError(true)}
          unoptimized
        />
        {rank && (
          <span className="absolute top-1.5 left-1.5 bg-black/50 backdrop-blur-sm text-white text-xs md:text-sm font-black px-2 py-0.5 rounded-md shadow-lg">
            #{rank}
          </span>
        )}
        <button onClick={(e) => { e.stopPropagation(); onToggleList(); }} className="absolute top-1 right-1 p-0.5 md:p-1 bg-black/60 rounded-full text-white/70 hover:text-amber-400 transition-colors z-10" aria-label={isInList ? 'Remove from watchlist' : 'Add to watchlist'}>
          <Bookmark className={`w-2.5 h-2.5 md:w-3 md:h-3 ${isInList ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]' : ''}`} />
        </button>
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="w-6 h-6 md:w-7 md:h-7 bg-amber-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-amber-600 transition-colors">
            <Play className="w-2.5 h-2.5 md:w-3 md:h-3 text-black fill-current ml-0.5" />
          </div>
        </div>
      </div>
      <h4 className="text-[10px] md:text-[11px] font-bold text-zinc-200 truncate group-hover:text-amber-400 cursor-pointer">{anime.title}</h4>
      <div className="flex justify-between text-[8px] md:text-[10px] text-zinc-500">
        <span>{anime.type}</span>
        <span className="text-amber-400">★ {anime.score}</span>
      </div>
    </div>
  );
});

const EpisodeCard = React.memo(function EpisodeCard({ episode, anime, onPlay }: any) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="group space-y-1 flex-shrink-0 w-[110px] md:w-[150px]">
      <div className="relative aspect-[3/4.2] bg-zinc-900 border border-zinc-900 rounded-lg overflow-hidden group-hover:border-amber-500/30 transition-all cursor-pointer" onClick={onPlay}>
        <Image
          src={imgError ? FALLBACK_IMAGE : getSafeImage(anime?.image)}
          alt={anime?.title || "Anime"}
          fill
          className="object-cover group-hover:scale-105"
          loading="lazy"
          onError={() => setImgError(true)}
          unoptimized
        />
        <span className="absolute bottom-1 right-1 bg-black/80 text-[7px] md:text-[8px] font-bold text-zinc-400 px-1 rounded">EP {episode.number}</span>
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="w-6 h-6 md:w-7 md:h-7 bg-amber-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-amber-600 transition-colors">
            <Play className="w-2.5 h-2.5 md:w-3 md:h-3 text-black fill-current ml-0.5" />
          </div>
        </div>
      </div>
      <h4 className="text-[10px] md:text-[11px] font-bold text-zinc-200 truncate group-hover:text-amber-400 cursor-pointer">{anime?.title || "Unknown"}</h4>
      <p className="text-[8px] md:text-[10px] text-zinc-500 truncate">{episode.title || `Episode ${episode.number}`}</p>
    </div>
  );
});

const SectionHeader = React.memo(function SectionHeader({ title, icon, onViewAll }: any) {
  return (
    <div className="flex justify-between items-center">
      <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
        <span className="text-xs md:text-base">{icon}</span> {title}
      </h3>
      {onViewAll && (
        <button onClick={onViewAll} className="text-[10px] md:text-[11px] font-semibold text-amber-500 hover:text-amber-400" aria-label="View all">View all</button>
      )}
    </div>
  );
});

// ============================================================
// MAIN HOMEPAGE
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
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [animeRes, episodesRes, scheduleRes, newsRes, featuredRes, newlyAddedRes] = await Promise.all([
          CloudflareAPI.getAnime(),
          CloudflareAPI.getEpisodes(),
          CloudflareAPI.getSchedule(),
          CloudflareAPI.getNews(),
          CloudflareAPI.getFeatured(),
          CloudflareAPI.getNewlyAdded(),
        ]);

        const freshAnime = animeRes.anime || [];
        const freshEpisodes = episodesRes.episodes || [];
        const freshSchedule = scheduleRes.schedule || [];
        const freshNews = newsRes.news || [];
        let freshFeatured = featuredRes.featured || [];
        let freshNewlyAdded = newlyAddedRes.newlyAdded || [];

        const validAnimeIds = new Set(freshAnime.map((a: any) => a.id));
        freshFeatured = freshFeatured.filter((id: string) => id && validAnimeIds.has(id));
        freshFeatured = [...new Set(freshFeatured)];
        freshNewlyAdded = freshNewlyAdded.filter((id: string) => id && validAnimeIds.has(id));
        freshNewlyAdded = [...new Set(freshNewlyAdded)];

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
        console.error('Failed to fetch data from Cloudflare:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

            if (historyRows.length === 0 && wlIds.length === 0 && hasCache) return;

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

  useEffect(() => {
    if (featuredIds.length === 0) return;
    const interval = setInterval(() => {
      setCurrentFeaturedIndex(prev => (prev + 1) % featuredIds.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [featuredIds]);

  const episodesWithLang = useMemo(() => {
    if (selectedLanguage === 'all') return episodes;
    return episodes.filter(ep => ep.languages && ep.languages[selectedLanguage] && ep.languages[selectedLanguage].trim() !== '');
  }, [episodes, selectedLanguage]);

  const animeIdsWithLang = useMemo(() => new Set(episodesWithLang.map(ep => ep.anime_id)), [episodesWithLang]);
  const filteredAnimeList = useMemo(() => {
    if (selectedLanguage === 'all') return animeList;
    return animeList.filter(a => animeIdsWithLang.has(a.id));
  }, [animeList, animeIdsWithLang, selectedLanguage]);

  const displayAnime = filteredAnimeList.length > 0 ? filteredAnimeList : animeList;

  const allGenres = useMemo(() => {
    return [...new Set(displayAnime.flatMap(a => (a.genre || '').split(',').map(g => g.trim())).filter(Boolean))].sort();
  }, [displayAnime]);

  const initialGenres = useMemo(() => {
    return [
      { name: "All", icon: "✨" },
      ...allGenres.slice(0, 8).map(g => ({ name: g, icon: '📌' })),
      { name: "More", icon: "•••" }
    ];
  }, [allGenres]);

  const extendedGenres = useMemo(() => {
    return [
      { name: "All", icon: "✨" },
      ...allGenres.map(g => ({ name: g, icon: '📌' })),
    ];
  }, [allGenres]);

  const displayedGenres = showAllGenres ? extendedGenres : initialGenres;

  const genreFiltered = useMemo(() => {
    if (activeGenre === 'All') return displayAnime;
    return displayAnime.filter(a => (a.genre || '').toLowerCase().includes(activeGenre.toLowerCase()));
  }, [displayAnime, activeGenre]);

  // ---------- Newly Added: 52 most recent ----------
  const fullNewlyAdded = useMemo(() => {
    let result = genreFiltered.filter(a => a.created_at);
    result.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
    return result.slice(0, 52);
  }, [genreFiltered]);

  const fullTopRated = useMemo(() => {
    return [...genreFiltered]
      .filter(a => (a.score || 0) >= 7)
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [genreFiltered]);

  // ---------- Latest Updates: keep episode data ----------
  const fullLatestEpisodes = useMemo(() => {
    const filtered = episodesWithLang.filter(ep => displayAnime.some(a => a.id === ep.anime_id));
    return filtered.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (dateA && dateB) return dateB - dateA;
      return (parseInt(b.id) - parseInt(a.id));
    });
  }, [episodesWithLang, displayAnime]);

  const newlyAdded = useMemo(() => fullNewlyAdded.slice(0, 7), [fullNewlyAdded]);
  const topRated = useMemo(() => fullTopRated.slice(0, 12), [fullTopRated]);
  const latestEpisodes = useMemo(() => fullLatestEpisodes.slice(0, 12), [fullLatestEpisodes]);

  const trendingAnime = useMemo(() => {
    return [...genreFiltered].sort((a, b) => (parseInt(b.id) - parseInt(a.id)));
  }, [genreFiltered]);

  const uniqueTypes = useMemo(() => {
    const types = displayAnime
      .map(a => normalizeType(a.type))
      .filter(Boolean);
    return [...new Set(types)];
  }, [displayAnime]);

  const popularAnime = useMemo(() => {
    const filtered = popularTypeFilter === 'All'
      ? genreFiltered
      : genreFiltered.filter(a => normalizeType(a.type) === popularTypeFilter);
    return filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [genreFiltered, popularTypeFilter]);

  const featuredAnime = featuredIds.length > 0
    ? animeList.find(a => a.id === featuredIds[currentFeaturedIndex % featuredIds.length])
    : null;

  const publishedNews = useMemo(() => {
    return newsItems.filter(n => n.status === 'published').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [newsItems]);

  const mostWatched = useMemo(() => {
    return [...displayAnime].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
  }, [displayAnime]);

  const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  // ---------- Build items for the overlay ----------
  const fullListItems = useMemo(() => {
    if (!fullList) return [];
    switch (fullList.type) {
      case 'updates':
        // Each item is an episode with its own data, plus a reference to the anime
        return fullLatestEpisodes.map(ep => {
          const anime = displayAnime.find(a => a.id === ep.anime_id);
          return {
            ...ep,                  // episode id, number, title, etc.
            _anime: anime,         // full anime object for display
          };
        });
      case 'popular':
        return popularAnime;
      case 'trending':
        return trendingAnime;
      case 'newlyAdded':
        return fullNewlyAdded;
      case 'topRated':
        return fullTopRated;
      default:
        return trendingAnime;
    }
  }, [fullList, fullLatestEpisodes, displayAnime, popularAnime, trendingAnime, fullNewlyAdded, fullTopRated]);

  const getOverlayProps = useCallback(() => {
    if (fullList?.type === 'newlyAdded') {
      return { initialCount: 26, batchSize: 11 };
    }
    return { initialCount: 50, batchSize: 50 };
  }, [fullList]);

  // ---------- Handlers ----------
  const toggleWatchlist = useCallback(async (anime: any) => {
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
  }, [user, watchlistIds, rawWatchHistory]);

  const isInList = useCallback((anime: any) => watchlistIds.includes(anime.id), [watchlistIds]);

  const goToPrevHero = useCallback(() => {
    if (featuredIds.length === 0) return;
    setCurrentFeaturedIndex(prev => (prev - 1 + featuredIds.length) % featuredIds.length);
  }, [featuredIds]);

  const goToNextHero = useCallback(() => {
    if (featuredIds.length === 0) return;
    setCurrentFeaturedIndex(prev => (prev + 1) % featuredIds.length);
  }, [featuredIds]);

  // ---------- handlePlay: supports both anime and episode ----------
  const handlePlay = useCallback((item: any) => {
    if (item.anime_id && item.number !== undefined) {
      // It's an episode: go to the episode page
      router.push(`/watch?anime=${item.anime_id}&ep=${item.number}`);
    } else if (item.id) {
      // It's an anime: go to the anime page (episode 1)
      router.push(`/watch?anime=${item.id}`);
    }
  }, [router]);

  const goToWatchHistory = useCallback(() => router.push('/profile?tab=Watch%20History'), [router]);
  const goToMyList = useCallback(() => router.push('/profile?tab=My%20List'), [router]);

  const handleNewsClick = useCallback((news: NewsItem) => setSelectedNews(news), []);
  const handleCloseNews = useCallback(() => setSelectedNews(null), []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (loading && !animeList.length) {
    return (
      <div className="max-w-[1400px] mx-auto w-full px-3 md:px-6 py-4 space-y-5">
        <div className="h-[300px] md:h-80 bg-zinc-900 rounded-2xl animate-pulse" />
        <CarouselSkeleton count={7} />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (selectedNews) {
    return (
      <div className="min-h-screen bg-[#040406] text-zinc-100 font-sans selection:bg-amber-500 flex flex-col">
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6 pb-24 md:pb-12">
          <button onClick={handleCloseNews} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group" aria-label="Back to home">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-bold">Back to Home</span>
          </button>
          <div className="bg-[#0d0d14] border border-zinc-900 rounded-2xl overflow-hidden">
            {selectedNews.image && (
              <div className="w-full aspect-video bg-zinc-900 overflow-hidden relative">
                <Image
                  src={getSafeImage(selectedNews.image)}
                  alt={selectedNews.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  unoptimized
                />
              </div>
            )}
            <div className="p-6 md:p-10 space-y-4">
              <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                <span>{selectedNews.date || 'Just now'}</span>
                {selectedNews.author && (<><span className="text-zinc-700">•</span><span>{selectedNews.author}</span></>)}
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

  const overlayProps = getOverlayProps();

  return (
    <>
      {fullList && (
        <FullListOverlay
          type={fullList.type}
          title={fullList.title}
          items={fullListItems}
          onClose={() => setFullList(null)}
          onPlay={handlePlay}
          onToggleList={toggleWatchlist}
          isInList={isInList}
          initialCount={overlayProps.initialCount}
          batchSize={overlayProps.batchSize}
        />
      )}

      <HeroSection
        anime={featuredAnime}
        index={currentFeaturedIndex}
        total={featuredIds.length}
        onPrev={goToPrevHero}
        onNext={goToNextHero}
        onWatch={() => featuredAnime && handlePlay(featuredAnime)}
        onToggleList={() => featuredAnime && toggleWatchlist(featuredAnime)}
        isInList={featuredAnime ? isInList(featuredAnime) : false}
      />

      <div className="max-w-[1400px] mx-auto w-full px-0 md:px-6 py-4 md:py-5 space-y-5 md:space-y-6">
        <div className="px-3 md:px-0">
          <GenreFilter
            genres={displayedGenres}
            activeGenre={activeGenre}
            onSelect={setActiveGenre}
            showAll={showAllGenres}
            onToggleShowAll={() => setShowAllGenres(!showAllGenres)}
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          <div className="w-full lg:w-[70%] flex flex-col gap-5 md:gap-6">
            
            <section className="space-y-2 md:space-y-3 px-3 md:px-0 md:bg-[#0a0b12] md:border md:border-zinc-900/60 md:rounded-xl p-0 md:p-4">
              <SectionHeader title="Newly Added" icon="🆕" onViewAll={() => setFullList({ type: 'newlyAdded', title: 'Newly Added' })} />
              <div className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-none pb-2">
                {newlyAdded.map((anime, index) => (
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

            <section className="space-y-2 md:space-y-3 px-3 md:px-0 md:bg-[#0a0b12] md:border md:border-zinc-900/60 md:rounded-xl p-0 md:p-4">
              <SectionHeader
                title={`Trending Now ${activeGenre !== 'All' ? `in ${activeGenre}` : ''}`}
                icon={<Flame className="w-3 h-3 md:w-3.5 md:h-3.5 text-amber-500" />}
                onViewAll={() => setFullList({ type: 'trending', title: 'Trending Now' })}
              />
              <div className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-none pb-2">
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

            <section className="space-y-2 md:space-y-3 px-3 md:px-0 md:bg-[#0a0b12] md:border md:border-zinc-900/60 md:rounded-xl p-0 md:p-4">
              <SectionHeader title="Latest Updates" icon="⚡" onViewAll={() => setFullList({ type: 'updates', title: 'Latest Updates' })} />
              <div className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-none pb-2">
                {latestEpisodes.map(ep => {
                  const anime = displayAnime.find(a => a.id === ep.anime_id);
                  return (
                    <EpisodeCard
                      key={ep.id}
                      episode={ep}
                      anime={anime}
                      onPlay={() => handlePlay({ ...ep, _anime: anime })}
                    />
                  );
                })}
              </div>
            </section>

            <section className="space-y-2 md:space-y-3 px-3 md:px-0 md:bg-[#0a0b12] md:border md:border-zinc-900/60 md:rounded-xl p-0 md:p-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-1 border-b border-zinc-900/40">
                <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  ⭐ Popular Shows {activeGenre !== 'All' && `- ${activeGenre}`}
                </h3>
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                  <div className="flex items-center gap-1 bg-black/40 p-0.5 border border-zinc-900 rounded-md">
                    {["All", ...uniqueTypes].map(f => (
                      <button
                        key={f}
                        onClick={() => setPopularTypeFilter(f)}
                        className={`text-[9px] md:text-[10px] font-bold px-2 py-0.5 md:px-2.5 md:py-1 rounded transition-all duration-200 ${
                          popularTypeFilter === f ? "bg-amber-500 text-black shadow-[0_0_6px_rgba(245,158,11,0.3)]" : "text-zinc-500 hover:text-amber-400"
                        }`}
                        aria-label={`Filter by ${f}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-none pb-2">
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

            <section className="space-y-2 md:space-y-3 px-3 md:px-0 md:bg-[#0a0b12] md:border md:border-zinc-900/60 md:rounded-xl p-0 md:p-4">
              <SectionHeader title="Top Rated" icon="🏆" onViewAll={() => setFullList({ type: 'topRated', title: 'Top Rated' })} />
              <div className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-none pb-2">
                {topRated.map(anime => (
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 px-3 md:px-0">
              <div className="space-y-2 md:space-y-3 md:bg-[#0a0b12] md:border md:border-zinc-900/60 md:rounded-xl p-0 md:p-4">
                <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-zinc-400">📊 Most Watched</h3>
                <div className="flex flex-col gap-2">
                  {mostWatched.map((anime, idx) => (
                    <div key={anime.id} className="flex items-center gap-2 bg-[#0d0e1a]/40 p-2 rounded-lg hover:border-amber-500/30 group cursor-pointer" onClick={() => handlePlay(anime)}>
                      <span className="text-xs md:text-sm font-black text-zinc-600 group-hover:text-amber-500 w-5">{String(idx+1).padStart(2,'0')}</span>
                      <Image
                        src={getSafeImage(anime.image)}
                        alt={anime.title}
                        width={36}
                        height={36}
                        className="w-8 h-8 md:w-9 md:h-9 object-cover rounded-md"
                        loading="lazy"
                        unoptimized
                      />
                      <div className="min-w-0 flex-1"><h4 className="text-[10px] md:text-[11px] font-bold truncate">{anime.title}</h4></div>
                      <span className="text-[9px] md:text-[10px] text-amber-400">★ {anime.score}</span>
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

            {/* MOBILE ONLY */}
            <div className="block md:hidden space-y-5">
              <section className="space-y-2 px-3">
                <SectionHeader title="Continue Watching" icon="📺" onViewAll={goToWatchHistory} />
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
                  {!user ? (
                    <div className="text-xs text-zinc-500 py-4 w-full text-center">
                      <button onClick={() => router.push('/profile')} className="text-amber-400 hover:underline">Login</button> to see your continue watching.
                    </div>
                  ) : !userDataLoaded || animeList.length === 0 ? (
                    <div className="text-xs text-zinc-500 py-4 w-full text-center flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> Loading...
                    </div>
                  ) : continueWatching.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 w-full text-center">Start watching an episode to see it here.</p>
                  ) : (
                    continueWatching.map((item, i) => (
                      <div key={i} className="flex-shrink-0 w-[130px] space-y-1 cursor-pointer" onClick={() => handlePlay({ id: item.animeId })}>
                        <div className="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden">
                          <Image
                            src={item.animeImage}
                            alt={item.animeTitle}
                            fill
                            className="object-cover opacity-80"
                            loading="lazy"
                            unoptimized
                            sizes="(max-width: 768px) 130px, 130px"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Play className="w-4 h-4 text-white fill-current" />
                          </div>
                        </div>
                        <h4 className="text-[10px] font-bold text-zinc-200 truncate">{item.animeTitle}</h4>
                        <p className="text-[8px] text-zinc-500">EP {item.epNumber}</p>
                        <div className="h-0.5 bg-zinc-900 rounded-full">
                          <div className="h-full bg-amber-500" style={{ width: `${item.progress}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="space-y-2 px-3">
                <SectionHeader title="My Watchlist" icon="🔖" onViewAll={goToMyList} />
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
                  {!user ? (
                    <div className="text-xs text-zinc-500 py-4 w-full text-center">
                      <button onClick={() => router.push('/profile')} className="text-amber-400 hover:underline">Login</button> to add bookmarks.
                    </div>
                  ) : !userDataLoaded || animeList.length === 0 ? (
                    <div className="text-xs text-zinc-500 py-4 w-full text-center flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> Loading...
                    </div>
                  ) : watchlistItems.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 w-full text-center">Bookmark anime to see them here.</p>
                  ) : (
                    watchlistItems.map((item) => (
                      <div key={item.id} className="flex-shrink-0 w-[90px] space-y-1 cursor-pointer" onClick={() => handlePlay(item)}>
                        <div className="relative aspect-[3/4] bg-zinc-900 rounded-lg overflow-hidden border border-zinc-900">
                          <Image
                            src={item.image}
                            alt={item.title}
                            fill
                            className="object-cover"
                            loading="lazy"
                            unoptimized
                            sizes="(max-width: 768px) 90px, 90px"
                          />
                        </div>
                        <h4 className="text-[9px] font-bold text-zinc-200 truncate">{item.title}</h4>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="space-y-2 px-3">
                <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-zinc-400">📰 Anime News</h3>
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
                  {publishedNews.slice(0, 5).map((n) => (
                    <div key={n.id} onClick={() => handleNewsClick(n)} className="flex-shrink-0 w-[200px] bg-[#0d0e1a]/40 border border-zinc-900/60 p-2.5 rounded-xl flex gap-2.5 cursor-pointer hover:border-amber-500/30 transition-all">
                      {n.image && (
                        <Image
                          src={getSafeImage(n.image)}
                          alt=""
                          width={56}
                          height={56}
                          className="w-14 h-14 object-cover rounded-lg shrink-0"
                          loading="lazy"
                          unoptimized
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[10px] font-bold text-zinc-200 line-clamp-2">{n.title}</h4>
                        <p className="text-[8px] text-zinc-400 mt-1 line-clamp-2">{n.content}</p>
                        <p className="text-[7px] text-zinc-600 mt-1">{n.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-2 px-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">🎯 Recommended</h3>
                  <button onClick={() => setFullList({ type: 'trending', title: 'Trending Now' })} className="text-[10px] md:text-[11px] font-semibold text-amber-500 hover:text-amber-400">View all</button>
                </div>
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
                  {trendingAnime.slice(0, 8).map(anime => (
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
          </div>

          {/* DESKTOP SIDEBAR */}
          <div className="hidden lg:flex lg:w-[30%] flex-col gap-5 sticky top-20">
            <div className="bg-[#0a0b12] border border-zinc-900/60 rounded-xl p-4 space-y-3">
              <SectionHeader title="Continue Watching" icon="📺" onViewAll={goToWatchHistory} />
              {!user ? (
                <div className="text-xs text-zinc-500 py-4 text-center">
                  <button onClick={() => router.push('/profile')} className="text-amber-400 hover:underline">Login</button> to see your continue watching.
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
                        <Image
                          src={item.animeImage}
                          alt=""
                          fill
                          className="object-cover opacity-80"
                          loading="lazy"
                          unoptimized
                          sizes="64px"
                        />
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
                      <span className="text-[10px] font-semibold text-zinc-500 shrink-0">{item.progress}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#0a0b12] border border-zinc-900/60 rounded-xl p-4 space-y-3">
              <SectionHeader title="My Watchlist" icon="🔖" onViewAll={goToMyList} />
              {!user ? (
                <div className="text-xs text-zinc-500 py-4 text-center">
                  <button onClick={() => router.push('/profile')} className="text-amber-400 hover:underline">Login</button> to add bookmarks.
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
                        <Image
                          src={item.image}
                          alt=""
                          width={32}
                          height={32}
                          className="w-8 h-8 object-cover rounded border border-zinc-900 shrink-0"
                          loading="lazy"
                          unoptimized
                        />
                        <h4 className="text-[11px] font-bold truncate text-zinc-300">{item.title}</h4>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); toggleWatchlist(item); }} className="text-zinc-500 hover:text-amber-500 shrink-0" aria-label={isInList(item) ? 'Remove from watchlist' : 'Add to watchlist'}>
                        <Bookmark className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
        </div>
      </div>

      <button
        onClick={scrollToTop}
        className={`fixed bottom-24 right-4 z-30 p-2 rounded-full bg-amber-500 text-black shadow-lg shadow-amber-500/30 transition-all duration-300 md:hidden ${
          showBackToTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
        aria-label="Back to top"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </>
  );
}