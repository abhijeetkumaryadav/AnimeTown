"use client";

import { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import { 
  Search, X, ChevronDown, Flame, Star, ChevronLeft, ChevronRight,
  Bookmark, Play
} from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabaseClient';
import { CloudflareAPI } from '@/lib/db-client'; 
// ============================================================
// TYPES
// ============================================================
interface Anime {
  id: string; // Cloudflare uses UUID
  title: string;
  image: string;
  type: string;
  score: number;
  genre: string;
  views?: number;
  year: number;
  episodes: number;
  status: string;
}

interface Episode {
  id: string;
  anime_id: string;
  number: number;
  title: string;
  languages?: Record<string, string>;
}

// ============================================================
// CACHE HELPERS
// ============================================================
const SEARCH_CACHE_KEY = 'searchDataCache';

function getCachedSearchData() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSearchCache(animeList: Anime[], episodes: Episode[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ animeList, episodes }));
  } catch {}
}

function getCachedWatchlist(userId: string): any[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`searchWatchlist_${userId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveWatchlistCache(userId: string, items: any[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`searchWatchlist_${userId}`, JSON.stringify(items));
  } catch {}
}

// ============================================================
// COMPONENTS
// ============================================================

function AnimeCard({ anime, isMobile = false, watchlistItems, onToggleWatchlist, onOpenWatch }: any) {
  const isInList = watchlistItems.some((i: any) => i.id === anime.id);
  
  return (
    <div
      onClick={() => onOpenWatch(anime)}
      className={`group cursor-pointer bg-[#0d0d14] border border-zinc-900/80 rounded-xl overflow-hidden hover:border-amber-500/20 transition-all shadow-sm ${
        isMobile ? 'p-1.5 space-y-1' : 'p-2.5 space-y-2'
      }`}
    >
      <div className="relative aspect-[3/4] bg-zinc-900 rounded-lg overflow-hidden">
        <img src={anime.image} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleWatchlist(anime); }} 
          className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-full text-white/70 hover:text-yellow-400 transition-colors z-10"
        >
          <Bookmark className={`w-3 h-3 ${isInList ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        </button>
        <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-[8px] font-bold text-amber-400 px-1 py-0.5 rounded flex items-center gap-0.5">
          <Star className="w-2 h-2 fill-current text-amber-400" /> {anime.score || '?'}
        </div>
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center hover:bg-amber-600 transition-colors cursor-pointer">
            <Play className="w-3 h-3 text-black fill-current ml-0.5" />
          </div>
        </div>
      </div>
      <div className="px-0.5">
        <h3 className={`font-bold text-zinc-200 line-clamp-2 group-hover:text-amber-400 transition-colors leading-tight ${
          isMobile ? 'text-[10px] min-h-[26px]' : 'text-xs min-h-[32px]'
        }`}>{anime.title}</h3>
        <p className={`text-zinc-500 font-medium pt-0.5 ${isMobile ? 'text-[8px]' : 'text-[10px]'}`}>
          {anime.episodes} Episodes • {anime.year}
        </p>
      </div>
    </div>
  );
}

function Pagination({ currentPage, totalPages, onPageChange, className = '' }: any) {
  if (totalPages <= 1) return null;
  
  return (
    <div className={`flex items-center justify-center gap-1.5 pt-2 ${className}`}>
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="flex items-center gap-1 text-zinc-500 hover:text-amber-400 transition-colors text-[11px] font-bold px-2.5 py-1 rounded-lg hover:bg-zinc-900 disabled:opacity-40"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Prev
      </button>
      <span className="text-xs text-zinc-400 font-bold px-1.5">
        {currentPage} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="flex items-center gap-1 text-zinc-400 hover:text-amber-400 transition-colors text-[11px] font-bold px-2.5 py-1 rounded-lg hover:bg-zinc-900 disabled:opacity-40"
      >
        Next <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#0d0d14] border border-zinc-900/80 rounded-xl overflow-hidden p-1.5 space-y-1 animate-pulse">
      <div className="aspect-[3/4] bg-zinc-800 rounded-lg" />
      <div className="h-2.5 bg-zinc-800 rounded w-3/4" />
      <div className="h-2 bg-zinc-800 rounded w-1/2" />
    </div>
  );
}

// ============================================================
// EMPTY STATE SVG (Search‑themed)
// ============================================================
function EmptySearchIllustration() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-32 h-32 mx-auto">
      <circle cx="100" cy="100" r="80" fill="url(#searchGlow)" opacity="0.15" />
      <path d="M140 140 L120 120" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity="0.2" />
      <circle cx="95" cy="95" r="35" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity="0.15" />
      <circle cx="95" cy="95" r="25" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.1" />
      <circle cx="85" cy="88" r="3" fill="currentColor" opacity="0.2" />
      <circle cx="105" cy="88" r="3" fill="currentColor" opacity="0.2" />
      <path d="M88 100 Q95 106 102 100" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.15" />
      <circle cx="150" cy="60" r="4" fill="#f59e0b" opacity="0.3" />
      <circle cx="165" cy="80" r="2.5" fill="#f59e0b" opacity="0.2" />
      <circle cx="50" cy="55" r="3" fill="#f59e0b" opacity="0.2" />
      <circle cx="40" cy="75" r="2" fill="#f59e0b" opacity="0.15" />
      <defs>
        <radialGradient id="searchGlow" cx="100" cy="100" r="80">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// ============================================================
// MAIN SEARCH PAGE
// ============================================================
export default function SearchPage({
  navigateTo,
}: {
  navigateTo?: (page: string, tab?: string, params?: any) => void;
}) {
  const { user, selectedLanguage, loading: authLoading } = useApp();

  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState('All');
  const [sortBy, setSortBy] = useState('Popular');
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 18;

  const [mobilePage, setMobilePage] = useState(1);

  const genreDropdownRef = useRef<HTMLDivElement>(null);
  const mobileContentRef = useRef<HTMLDivElement>(null);

  // ---- Instant cache load ----
  useLayoutEffect(() => {
    const cachedSearch = getCachedSearchData();
    if (cachedSearch) {
      setAnimeList(cachedSearch.animeList || []);
      setEpisodes(cachedSearch.episodes || []);
    }
    if (user) {
      const cachedWatchlist = getCachedWatchlist(user.id);
      if (cachedWatchlist) {
        setWatchlistItems(cachedWatchlist);
      }
    }
    if (cachedSearch) {
      setDataLoading(false);
    }
  }, [user]);

  // ---- Load anime & episodes from Cloudflare ----
  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);
      try {
        const [animeRes, episodesRes] = await Promise.all([
          CloudflareAPI.getAnime(),
          CloudflareAPI.getEpisodes(),
        ]);
        const freshAnime = animeRes.anime || [];
        const freshEpisodes = episodesRes.episodes || [];
        setAnimeList(freshAnime);
        setEpisodes(freshEpisodes);
        saveSearchCache(freshAnime, freshEpisodes);
      } catch (error) {
        console.error('Failed to fetch search data:', error);
      }
      setDataLoading(false);
    };
    fetchData();
  }, []);

  // ---- Load user's watchlist ----
  useEffect(() => {
    if (!user) {
      setWatchlistItems([]);
      return;
    }

    const loadWatchlist = async () => {
      try {
        const { data, error } = await supabase
          .from('bookmarks')
          .select('anime_id')
          .eq('user_id', user.id);
        if (error) throw error;
        const items = data.map((b: any) => {
          const anime = animeList.find(a => a.id === b.anime_id);
          return {
            id: b.anime_id,
            title: anime?.title || 'Unknown',
            image: anime?.image || '',
            type: anime?.type || 'TV',
          };
        });
        setWatchlistItems(items);
        saveWatchlistCache(user.id, items);
      } catch (error) {
        console.error('Error loading watchlist:', error);
      }
    };

    loadWatchlist();
  }, [user, animeList]);

  // ---- Outside click handler ----
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        genreDropdownRef.current &&
        !genreDropdownRef.current.contains(event.target as Node)
      ) {
        setShowGenreDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---- Scroll to top when page changes ----
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (mobileContentRef.current) {
      mobileContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage, mobilePage]);

  // ---- Language filtering ----
  const languageFilteredAnime = useMemo(() => {
    if (selectedLanguage === 'all') return animeList;
    if (animeList.length === 0 || episodes.length === 0) return animeList;
    const animeIdsWithLang = new Set(
      episodes
        .filter(ep => ep.languages && ep.languages[selectedLanguage] && ep.languages[selectedLanguage].trim() !== '')
        .map(ep => ep.anime_id)
    );
    return animeList.filter(a => animeIdsWithLang.has(a.id));
  }, [animeList, episodes, selectedLanguage]);

  const displayAnime = languageFilteredAnime;

  const allGenres = useMemo(() => {
    return [...new Set(displayAnime.flatMap(a => (a.genre || '').split(',').map(g => g.trim())).filter(Boolean))].sort();
  }, [displayAnime]);

  // ---------- FIX: case‑insensitive type filter ----------
  const typeFiltered = useMemo(() => {
    if (activeType === 'All') return displayAnime;
    const lowerType = activeType.toLowerCase();
    return displayAnime.filter(a => a.type.toLowerCase() === lowerType);
  }, [displayAnime, activeType]);

  const genreFiltered = useMemo(() => {
    return selectedGenre === 'All' ? typeFiltered : typeFiltered.filter(a => a.genre && a.genre.toLowerCase().includes(selectedGenre.toLowerCase()));
  }, [typeFiltered, selectedGenre]);

  const searchFiltered = useMemo(() => {
    if (searchQuery.trim() === '') return genreFiltered;
    const q = searchQuery.toLowerCase();
    return genreFiltered.filter(a => 
      a.title.toLowerCase().includes(q) || 
      (a.genre && a.genre.toLowerCase().includes(q))
    );
  }, [genreFiltered, searchQuery]);

  let sorted = useMemo(() => {
    const list = [...searchFiltered];
    if (sortBy === 'Popular') list.sort((a, b) => (b.views || 0) - (a.views || 0));
    else if (sortBy === 'Score') list.sort((a, b) => (b.score || 0) - (a.score || 0));
    else if (sortBy === 'Newest') list.sort((a, b) => (b.year || 0) - (a.year || 0));
    else if (sortBy === 'A-Z') list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [searchFiltered, sortBy]);

  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const pagedItems = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isSearching = searchQuery.trim() !== '';

  const topResultsAnime = useMemo(() => {
    return [...displayAnime].sort((a, b) => (b.views || 0) - (a.views || 0));
  }, [displayAnime]);

  const tvSeriesAnime = useMemo(() => {
    return displayAnime.filter(a => a.type.toLowerCase() === 'tv' || a.type.toLowerCase() === 'tv series');
  }, [displayAnime]);

  const moviesAnime = useMemo(() => {
    return displayAnime.filter(a => a.type.toLowerCase() === 'movie');
  }, [displayAnime]);

  const mobileFiltered = useMemo(() => sorted, [sorted]);
  const mobileTotalPages = Math.ceil(mobileFiltered.length / itemsPerPage);
  const mobilePagedItems = mobileFiltered.slice((mobilePage - 1) * itemsPerPage, mobilePage * itemsPerPage);

  const clearSearch = () => { setSearchQuery(''); setCurrentPage(1); setMobilePage(1); };

  const toggleWatchlist = useCallback(async (anime: any) => {
    if (!user) {
      alert('Please login to add to watchlist!');
      return;
    }
    const exists = watchlistItems.find((i: any) => i.id === anime.id);
    let updated;
    if (exists) {
      updated = watchlistItems.filter((i: any) => i.id !== anime.id);
      await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('anime_id', anime.id);
    } else {
      updated = [...watchlistItems, { id: anime.id, title: anime.title, image: anime.image, type: anime.type }];
      await supabase.from('bookmarks').insert({ user_id: user.id, anime_id: anime.id });
    }
    setWatchlistItems(updated);
    saveWatchlistCache(user.id, updated);
  }, [user, watchlistItems]);

  const openWatch = useCallback((anime: any) => {
    if (navigateTo) {
      navigateTo('watch', undefined, { anime: anime.id });
    } else {
      window.location.href = `/watch?anime=${anime.id}`;
    }
  }, [navigateTo]);

  const handleTypeChange = (type: string) => {
    setActiveType(type);
    setCurrentPage(1);
    setMobilePage(1);
  };

  const handleGenreChange = (genre: string) => {
    setSelectedGenre(genre);
    setShowGenreDropdown(false);
    setCurrentPage(1);
    setMobilePage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    setMobilePage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleMobilePageChange = (page: number) => {
    setMobilePage(page);
  };

  const showMobileFirstPageRows = !isSearching && mobilePage === 1 && activeType === 'All' && selectedGenre === 'All';

  const showSkeleton = dataLoading && !animeList.length;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      {/* ==================== DESKTOP VIEW ==================== */}
      <div className="hidden md:flex flex-col flex-1">
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8 space-y-8">
          <div className="space-y-4 bg-[#0d0d14] p-6 rounded-2xl border border-zinc-900 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center bg-[#07070a] border border-zinc-800 rounded-xl px-4 py-3 gap-3 focus-within:border-amber-500/40 transition-all">
                <Search className="w-4 h-4 text-zinc-500" />
                <input 
                  type="text" 
                  value={searchQuery} 
                  onChange={(e) => handleSearchChange(e.target.value)} 
                  className="bg-transparent text-sm font-medium text-zinc-200 outline-none flex-1 placeholder-zinc-600" 
                  placeholder="Search series, movies, characters…" 
                />
                {searchQuery && (
                  <button onClick={clearSearch} className="text-zinc-500 hover:text-amber-400">
                    <X className="w-4 h-4 bg-zinc-800 rounded-full p-0.5" />
                  </button>
                )}
              </div>
              <button className="bg-amber-500 text-black p-3 rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20">
                <Search className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-900">
              <div className="flex flex-wrap gap-1.5">
                {['All', 'TV', 'Movie', 'OVA', 'ONA', 'Special'].map((type) => (
                  <button 
                    key={type} 
                    onClick={() => handleTypeChange(type)} 
                    className={`text-[11px] font-bold px-4 py-2 rounded-lg border transition-all duration-200 ${
                      activeType === type 
                        ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/10" 
                        : "bg-[#07070a] border-zinc-800/80 text-zinc-400 hover:border-amber-500/50 hover:text-amber-400"
                    }`}
                  >
                    {type === 'All' ? 'All' : type}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative" ref={genreDropdownRef}>
                  <button 
                    onClick={() => setShowGenreDropdown(!showGenreDropdown)} 
                    className="flex items-center gap-2 bg-[#07070a] border border-zinc-800 px-4 py-2 rounded-lg text-[11px] font-bold text-zinc-400 hover:border-amber-500/50 hover:text-amber-400 transition-all"
                  >
                    {selectedGenre === 'All' ? 'Genre' : selectedGenre} <ChevronDown className="w-3 h-3 text-zinc-500" />
                  </button>
                  {showGenreDropdown && (
                    <div className="absolute left-0 mt-2 w-48 bg-[#0d0d14] border border-zinc-800 rounded-xl p-2 shadow-xl z-20 max-h-60 overflow-y-auto">
                      <button 
                        onClick={() => handleGenreChange('All')} 
                        className="block w-full text-left px-3 py-1.5 text-xs rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
                      >
                        All Genres
                      </button>
                      {allGenres.map((genre: string) => (
                        <button 
                          key={genre} 
                          onClick={() => handleGenreChange(genre)} 
                          className={`block w-full text-left px-3 py-1.5 text-xs rounded-lg ${
                            selectedGenre === genre ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          {genre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setSortBy(sortBy === 'Popular' ? 'Score' : sortBy === 'Score' ? 'Newest' : sortBy === 'Newest' ? 'A-Z' : 'Popular')} 
                  className="flex items-center gap-2 bg-[#07070a] border border-zinc-800 px-4 py-2 rounded-lg text-[11px] font-bold text-zinc-400 hover:border-amber-500/50 hover:text-amber-400 transition-all"
                >
                  {sortBy} <ChevronDown className="w-3 h-3 text-zinc-500" />
                </button>
              </div>
            </div>
          </div>

          {showSkeleton ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {[...Array(12)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : pagedItems.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              {isSearching ? `No results for "${searchQuery}"` : 'No anime found.'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {pagedItems.map((anime: any) => (
                  <AnimeCard 
                    key={anime.id} 
                    anime={anime} 
                    watchlistItems={watchlistItems}
                    onToggleWatchlist={toggleWatchlist}
                    onOpenWatch={openWatch}
                  />
                ))}
              </div>
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={handlePageChange} 
              />
            </>
          )}
        </main>
      </div>

      {/* ==================== MOBILE VIEW ==================== */}
      <div className="block md:hidden flex-1 flex flex-col">
        {/* Search Bar – with top gap (pt-3) */}
        <div className="px-3 pt-3 pb-2 bg-[#07070a] border-b border-zinc-900/40">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-[#0d0d12] border border-zinc-800 rounded-xl px-3 py-2 gap-2 focus-within:border-amber-500/40 transition-all">
              <Search className="w-3.5 h-3.5 text-zinc-500" />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => handleSearchChange(e.target.value)} 
                className="bg-transparent text-xs font-medium text-zinc-200 outline-none flex-1 placeholder-zinc-600" 
                placeholder="Search…" 
              />
              {searchQuery && (
                <button onClick={clearSearch} className="text-zinc-500 hover:text-amber-400">
                  <X className="w-3 h-3 bg-zinc-800 rounded-full p-0.5" />
                </button>
              )}
            </div>
          </div>

          {/* Mobile filter chips – type only */}
          <div className="mt-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
            {['All', 'TV', 'Movie', 'OVA', 'ONA', 'Special'].map((type) => (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={`text-[9px] font-bold px-2.5 py-1 rounded-lg border transition-all duration-200 whitespace-nowrap ${
                  activeType === type
                    ? "bg-amber-500 border-amber-500 text-black shadow-[0_0_6px_rgba(245,158,11,0.3)]"
                    : "bg-[#0d0d12] border-zinc-900 text-zinc-400 hover:border-amber-500/50 hover:text-amber-400"
                }`}
              >
                {type === 'All' ? 'All' : type}
              </button>
            ))}
          </div>
        </div>

        {/* ===== MOBILE CONTENT (scrollable) ===== */}
        <main ref={mobileContentRef} className="flex-1 overflow-y-auto pb-24 scrollbar-none">
          {showSkeleton ? (
            <div className="px-3 pt-2 grid grid-cols-2 gap-2.5">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <>
              {/* FIRST PAGE – rows only */}
              {showMobileFirstPageRows && (
                <div className="space-y-4 pt-2">
                  {topResultsAnime.length > 0 && (
                    <section className="space-y-1.5">
                      <div className="px-3 flex items-center gap-1.5">
                        <Flame className="w-3 h-3 text-amber-500 fill-current" />
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-300">Top Results</h3>
                      </div>
                      <div className="overflow-x-auto px-3 flex gap-2 scrollbar-none">
                        {topResultsAnime.map((anime) => (
                          <div key={anime.id} className="min-w-[105px] w-[105px] flex-shrink-0">
                            <AnimeCard 
                              anime={anime} 
                              isMobile 
                              watchlistItems={watchlistItems}
                              onToggleWatchlist={toggleWatchlist}
                              onOpenWatch={openWatch}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {tvSeriesAnime.length > 0 && (
                    <section className="space-y-1.5">
                      <div className="px-3 flex items-center gap-1.5">
                        <span className="text-zinc-400 text-xs">📺</span>
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-300">TV Series</h3>
                      </div>
                      <div className="overflow-x-auto px-3 flex gap-2 scrollbar-none">
                        {tvSeriesAnime.map((anime) => (
                          <div key={anime.id} className="min-w-[105px] w-[105px] flex-shrink-0">
                            <AnimeCard 
                              anime={anime} 
                              isMobile 
                              watchlistItems={watchlistItems}
                              onToggleWatchlist={toggleWatchlist}
                              onOpenWatch={openWatch}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {moviesAnime.length > 0 && (
                    <section className="space-y-1.5">
                      <div className="px-3 flex items-center gap-1.5">
                        <span className="text-zinc-400 text-xs">🎬</span>
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-300">Movies</h3>
                      </div>
                      <div className="overflow-x-auto px-3 flex gap-2 scrollbar-none">
                        {moviesAnime.map((anime) => (
                          <div key={anime.id} className="min-w-[105px] w-[105px] flex-shrink-0">
                            <AnimeCard 
                              anime={anime} 
                              isMobile 
                              watchlistItems={watchlistItems}
                              onToggleWatchlist={toggleWatchlist}
                              onOpenWatch={openWatch}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="pb-4">
                    <Pagination 
                      currentPage={mobilePage} 
                      totalPages={mobileTotalPages} 
                      onPageChange={handleMobilePageChange} 
                      className="pt-1"
                    />
                  </div>
                </div>
              )}

              {/* PAGE 2+ OR FILTERED – Grid only */}
              {!showMobileFirstPageRows && (
                <div className="px-3 pt-2 space-y-3 pb-4">
                  <div className="grid grid-cols-2 gap-2.5">
                    {mobilePagedItems.length === 0 ? (
                      <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                        <EmptySearchIllustration />
                        <h3 className="text-base font-bold text-white mt-4">Nothing found</h3>
                        <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                          {searchQuery ? `No results for "${searchQuery}"` : 'Try adjusting your filters'}
                        </p>
                      </div>
                    ) : (
                      mobilePagedItems.map((anime: any) => (
                        <AnimeCard 
                          key={anime.id} 
                          anime={anime} 
                          isMobile 
                          watchlistItems={watchlistItems}
                          onToggleWatchlist={toggleWatchlist}
                          onOpenWatch={openWatch}
                        />
                      ))
                    )}
                  </div>
                  {mobilePagedItems.length > 0 && (
                    <div className="mb-4">
                      <Pagination 
                        currentPage={mobilePage} 
                        totalPages={mobileTotalPages} 
                        onPageChange={handleMobilePageChange} 
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}