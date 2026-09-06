"use client";

import { useState, useEffect, useRef, useMemo, Suspense, useLayoutEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, Maximize, ArrowLeft,
  Share2, Star, Bookmark, Send,
  AlertCircle, Loader2, VolumeX, LogIn,
  Flag, CheckCircle
} from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabaseClient';
import Hls from 'hls.js';
import { CloudflareAPI } from '@/lib/db-client';

// ---------- FIRESTORE ----------
import { db } from '@/lib/firebaseClient';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================
type StatusType = 'Watch Later' | 'Watching' | 'Completed' | 'Dropped';

interface Episode {
  id: string;
  number: number;
  title: string;
  anime_id: string;
  languages?: Record<string, string>;
  servers?: Record<string, Record<string, string>>;
}

interface Anime {
  id: string;
  title: string;
  image: string;
  description: string;
  type: string;
  score: number;
  genre: string;
  year: number;
  status: string;
  studio: string;
  episodes: number;
}

interface RawAnime {
  id: string;
  title: string;
  image: string;
  description: string;
  type: string;
  score: number;
  genre: string;
  year: number;
  status: string;
  studio: string;
  episodes: number;
}

interface RawEpisode {
  id: string;
  number: number;
  title: string;
  anime_id: string;
  languages?: Record<string, string>;
  servers?: Record<string, Record<string, string>>;
}

// ============================================================
// SHARED CACHE HELPERS
// ============================================================
const HOME_CACHE_KEY = 'homeDataCache';

function getCachedHomeData() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(HOME_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveToHomeCache(animeList: any[], episodes: any[]) {
  if (typeof window === 'undefined') return;
  try {
    const existingRaw = localStorage.getItem(HOME_CACHE_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const updated = {
      ...existing,
      animeList,
      episodes,
    };
    localStorage.setItem(HOME_CACHE_KEY, JSON.stringify(updated));
  } catch {}
}

function getWatchCacheKey(animeId: string) { return `watchCache_${animeId}`; }
function getCachedWatchData(animeId: string) {
  if (typeof window === 'undefined') return null;
  try { const raw = localStorage.getItem(getWatchCacheKey(animeId)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveWatchCache(animeId: string, data: any) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(getWatchCacheKey(animeId), JSON.stringify(data)); } catch {}
}

function getPublicCommentsCacheKey(animeId: string) { return `publicComments_${animeId}`; }
function getPublicCommentsCache(animeId: string) {
  if (typeof window === 'undefined') return null;
  try { const raw = localStorage.getItem(getPublicCommentsCacheKey(animeId)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function savePublicCommentsCache(animeId: string, comments: any[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(getPublicCommentsCacheKey(animeId), JSON.stringify(comments)); } catch {}
}

// ============================================================
// PROXY & HELPERS
// ============================================================
function getProxiedUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('/api/proxy')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        (typeof window !== 'undefined' && parsed.hostname === window.location.hostname)
      ) {
        return url;
      }
    } catch {}
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function formatEmbedUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  const ytMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;

  const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;

  const dailymotionMatch = trimmed.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  if (dailymotionMatch) return `https://www.dailymotion.com/embed/video/${dailymotionMatch[1]}?autoplay=1`;

  const gdriveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gdriveMatch) return `https://drive.google.com/file/d/${gdriveMatch[1]}/preview`;

  const okMatch = trimmed.match(/ok\.ru\/video\/(\d+)/);
  if (okMatch) return `https://ok.ru/videoembed/${okMatch[1]}`;

  if (trimmed.includes('nxsha.app')) {
    const match = trimmed.match(/\/watch\/tv\/(\d+)\/(\d+)\/(\d+)/);
    if (match) return `https://web.nxsha.app/embed/tv/${match[1]}/${match[2]}/${match[3]}`;
  }

  if (trimmed.includes('vidnest.fun')) {
    try {
      const urlObj = new URL(trimmed);
      if (!urlObj.searchParams.has('autoplay')) {
        urlObj.searchParams.set('autoplay', '0');
      }
      return urlObj.toString();
    } catch { return trimmed; }
  }

  if (trimmed.includes('/embed/')) return trimmed;
  return trimmed;
}

// ============================================================
// FALLBACK IMAGE
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
// COMPONENTS
// ============================================================

// ---- Episode List with Progress Bars ----
function EpisodeList({ episodes, currentEpisode, onSelect, episodeProgress }: any) {
  return (
    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2 max-h-64 overflow-y-auto pr-1">
      {episodes.map((ep: Episode) => {
        const isCurrent = ep.number === currentEpisode?.number;
        const progress = episodeProgress[ep.number] || 0;
        const isWatched = progress >= 100;
        const isPartial = progress > 0 && progress < 100;
        return (
          <button
            key={ep.id}
            onClick={() => onSelect(ep)}
            className={`relative px-1.5 sm:px-2 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all text-center touch-manipulation ${
              isCurrent
                ? 'bg-red-600 text-white ring-2 ring-red-500/50 shadow-lg shadow-red-500/20'
                : isWatched
                ? 'bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30'
                : isPartial
                ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-600/30'
                : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white'
            }`}
            aria-label={`Episode ${ep.number}${isWatched ? ' (Watched)' : isPartial ? ' (In progress)' : ''}`}
          >
            {ep.number}
            {progress > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-700 rounded-b-lg overflow-hidden">
                <div
                  className={`h-full ${isWatched ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            )}
            {isWatched && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle className="w-2 h-2 text-white fill-current" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---- Premium Action Bar (without Next Episode button) ----
function ActionBar({
  anime,
  episode,
  isBookmarked,
  onToggleBookmark,
  onShare,
  onReport,
  reporting,
  reportSuccess,
  availableLanguages,
  selectedLanguage,
  onLanguageChange,
  currentServerKeys,
  selectedServer,
  onServerChange,
}: any) {
  return (
    <div className="flex flex-nowrap items-center gap-2 sm:gap-4 p-2 sm:p-3 bg-zinc-900/30 backdrop-blur-sm rounded-2xl border border-zinc-800/40 shadow-lg overflow-x-auto scrollbar-none">
      <button
        onClick={onToggleBookmark}
        className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold transition-all touch-manipulation whitespace-nowrap shrink-0 ${
          isBookmarked
            ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40 shadow-lg shadow-amber-500/10'
            : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700 hover:text-amber-400'
        }`}
        aria-label={isBookmarked ? 'Remove from watchlist' : 'Add to watchlist'}
      >
        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
        <span className="hidden xs:inline">{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
        <span className="xs:hidden">{isBookmarked ? '✓' : '+'}</span>
      </button>

      <button
        onClick={onShare}
        className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700 hover:text-blue-400 transition-all touch-manipulation whitespace-nowrap shrink-0"
        aria-label="Share"
      >
        <Share2 className="w-3.5 h-3.5" />
        <span className="hidden xs:inline">Share</span>
      </button>

      <button
        onClick={onReport}
        disabled={reporting || reportSuccess}
        className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700 hover:text-red-400 transition-all touch-manipulation disabled:opacity-50 whitespace-nowrap shrink-0"
        aria-label="Report broken link"
      >
        <Flag className="w-3.5 h-3.5" />
        <span className="hidden xs:inline">{reportSuccess ? 'Reported' : 'Report'}</span>
        {reportSuccess && <CheckCircle className="w-3 h-3 text-green-400" />}
      </button>

      <div className="h-6 w-px bg-zinc-700/50 shrink-0 hidden sm:block" />

      {availableLanguages.length > 0 && (
        <select
          value={selectedLanguage}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="bg-zinc-800/80 border border-zinc-700/50 rounded-full px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-white touch-manipulation whitespace-nowrap shrink-0 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          aria-label="Select language"
        >
          {availableLanguages.map((lang: string) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
      )}

      {currentServerKeys.length > 0 && (
        <select
          value={selectedServer}
          onChange={(e) => onServerChange(e.target.value)}
          className="bg-zinc-800/80 border border-zinc-700/50 rounded-full px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-white touch-manipulation whitespace-nowrap shrink-0 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          aria-label="Select server"
        >
          {currentServerKeys.map((server: string, index: number) => (
            <option key={server} value={server}>
              Server {index + 1}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// ---- Comment Section ----
function CommentSection({ user, comments, newComment, setNewComment, onSubmit, onLogin }: any) {
  const [visibleCount, setVisibleCount] = useState(10);
  const visibleComments = comments.slice(0, visibleCount);
  const hasMore = visibleCount < comments.length;

  const loadMore = () => setVisibleCount(prev => Math.min(prev + 10, comments.length));

  return (
    <div className="space-y-4 lg:max-h-[500px] lg:overflow-y-auto lg:sticky lg:top-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Comments ({comments.length})</h3>
      {user ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none touch-manipulation focus:border-red-500/50"
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            aria-label="Write a comment"
          />
          <button
            onClick={onSubmit}
            className="bg-red-600 px-3 py-2 rounded-lg text-white text-xs font-bold touch-manipulation hover:bg-red-700 transition"
            aria-label="Post comment"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={onLogin}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-2.5 text-xs font-bold text-zinc-400 hover:text-red-400 hover:border-red-500/50 flex items-center justify-center gap-2 transition-all touch-manipulation"
          aria-label="Login to comment"
        >
          <LogIn className="w-3.5 h-3.5" /> Login to comment
        </button>
      )}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {visibleComments.map((c: any) => (
          <div key={c.id} className="space-y-1.5 pb-3 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-purple-500 rounded-full text-[10px] font-black flex items-center justify-center text-white">
                {c.avatar}
              </div>
              <span className="text-xs font-bold text-zinc-200">{c.username}</span>
              <span className="text-[9px] text-zinc-500">
                {new Date(c.timestamp).toLocaleDateString()}
              </span>
            </div>
            <p className="text-xs text-zinc-400 pl-8 break-words">{c.text}</p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-xs text-zinc-500 text-center py-4">No comments yet. Be the first!</p>
        )}
        {hasMore && (
          <button
            onClick={loadMore}
            className="w-full text-center text-[10px] text-zinc-500 hover:text-amber-400 py-2 transition-colors"
            aria-label="Load more comments"
          >
            Load more ({visibleCount}/{comments.length})
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Anime Info ----
function AnimeInfo({ anime, episode, userRating, hoverRating, setHoverRating, onRate, activeTab, setActiveTab }: any) {
  return (
    <div className="max-h-[500px] overflow-y-auto pr-1 space-y-4 sm:space-y-6">
      <div className="flex gap-4 sm:gap-6 border-b border-zinc-800 pb-2">
        {['Overview', 'Details'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-xs sm:text-sm font-black pb-2 relative whitespace-nowrap transition-colors touch-manipulation ${
              activeTab === tab ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            aria-label={`Show ${tab}`}
          >
            {tab}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-full" />}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
            <div className="space-y-1 sm:space-y-2">
              <h1 className="text-xl sm:text-2xl font-black text-white">{anime.title}</h1>
              <div className="flex items-center gap-2 flex-wrap text-[10px] sm:text-xs text-zinc-400">
                <span>{anime.year}</span><span>•</span><span>{anime.type}</span><span>•</span><span>Ep {episode?.number ?? '?'}</span>
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-1 sm:gap-2">
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map((s) => (
                  <button
                    key={s}
                    onMouseEnter={() => setHoverRating(s * 2)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => onRate(s)}
                    className="touch-manipulation"
                    aria-label={`Rate ${s * 2} stars`}
                  >
                    <Star
                      className={`w-4 h-4 sm:w-5 sm:h-5 ${
                        (hoverRating || userRating) >= s * 2
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-zinc-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-[10px] sm:text-xs text-zinc-500">
                {userRating > 0 ? `Your rating: ${userRating}/10` : 'Rate this anime'}
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{anime.description}</p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {anime.genre.split(',').map((g: string) => (
              <span
                key={g}
                className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-zinc-800/50 text-zinc-400"
              >
                {g.trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Details' && (
        <div className="space-y-2 sm:space-y-3 text-xs text-zinc-400">
          <div className="grid grid-cols-2 gap-2 text-zinc-500">
            <div>Studio: <span className="text-zinc-300">{anime.studio || 'Unknown'}</span></div>
            <div>Status: <span className="text-red-500">{anime.status || '?'}</span></div>
            <div>Episodes: <span className="text-zinc-300">{anime.episodes}</span></div>
            <div>Score: <span className="text-amber-400">★ {anime.score || '?'}</span></div>
          </div>
          <p className="text-xs">{anime.description}</p>
        </div>
      )}
    </div>
  );
}

// ---- Recommendations Row ----
function RecommendationsRow({ recommendations, onSelect }: any) {
  if (!recommendations || recommendations.length === 0) return null;
  return (
    <div className="space-y-3 mt-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">You May Also Like</h3>
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
        {recommendations.map((rec: any) => (
          <div
            key={rec.id}
            className="flex-shrink-0 w-[120px] sm:w-[140px] cursor-pointer group"
            onClick={() => onSelect(rec.id)}
          >
            <div className="aspect-[3/4] bg-zinc-900 rounded-lg overflow-hidden mb-2">
              <img
                src={getSafeImage(rec.image)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                alt={rec.title}
                loading="lazy"
              />
            </div>
            <h4 className="text-[10px] font-bold truncate text-zinc-200 group-hover:text-red-400">{rec.title}</h4>
            <p className="text-[9px] text-zinc-500">{rec.type} • ★ {rec.score}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// VIDEO PLAYER COMPONENT
// ============================================================
function VideoPlayer({
  anime,
  episode,
  currentServerUrl,
  isNative,
  isIframe,
  isVidnest,
  playerLoading,
  playerError,
  codecWarning,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackRate,
  controlsVisible,
  shieldVisible,
  iframeEnabled,
  showBackButton,
  showLoadingMsg,
  showReportBtn,
  reportSuccess,
  reporting,
  onBack,
  togglePlay,
  skipTime,
  toggleMute,
  changeVolume,
  changePlaybackRate,
  toggleFullscreen,
  seekVideo,
  handleVideoTap,
  handleInteraction,
  handleShieldTap,
  reportBrokenLink,
  videoRef,
  progressRef,
  playerContainerRef,
  onMouseEnter,
  onMouseLeave,
}: any) {
  return (
    <div
      ref={playerContainerRef}
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group"
      onMouseMove={handleInteraction}
      onTouchStart={handleInteraction}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Back button – auto‑hides after 3s, shows on hover */}
      <button
        onClick={onBack}
        className={`absolute top-3 left-3 z-40 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all touch-manipulation ${
          showBackButton ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } group-hover:opacity-100 group-hover:pointer-events-auto`}
        aria-label="Go back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Loading Overlay */}
      {playerLoading && (
        <div className="absolute inset-0 z-30 bg-[#0a0a0f] flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
          {showLoadingMsg && (
            <p className="text-zinc-400 text-center text-xs px-4 max-w-md">
              This video is hosted on an external server and may take up to 60 seconds to load.
              If nothing happens, the link might be broken.
            </p>
          )}
          {showReportBtn && !reportSuccess && (
            <button
              onClick={() => reportBrokenLink('Loading timeout')}
              disabled={reporting}
              className="mt-3 px-4 py-2 bg-red-600/20 border border-red-500/30 rounded-lg text-xs text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50 flex items-center gap-2 touch-manipulation"
              aria-label="Report broken link"
            >
              {reporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '⚠️'} Report
            </button>
          )}
          {reportSuccess && (
            <div className="mt-3 flex items-center gap-2 text-green-400 text-xs">
              ✅ Thank you! We'll check this link.
            </div>
          )}
        </div>
      )}

      {/* Error overlay */}
      {playerError && (
        <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-sm text-white">{playerError}</p>
          <div className="flex gap-2">
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 rounded-lg text-xs font-bold text-white hover:bg-red-700 touch-manipulation">Retry</button>
            {!reportSuccess ? (
              <button
                onClick={() => reportBrokenLink(playerError)}
                disabled={reporting}
                className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 flex items-center gap-2 touch-manipulation"
              >
                {reporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '⚠️'} Report
              </button>
            ) : (
              <div className="flex items-center gap-2 text-green-400 text-xs">✅ Reported!</div>
            )}
          </div>
        </div>
      )}

      {/* Codec warning */}
      {codecWarning && !playerError && !playerLoading && (
        <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <AlertCircle className="w-12 h-12 text-amber-400" />
          <p className="text-sm text-white">Video codec not supported by this browser.</p>
          <p className="text-xs text-zinc-400">Try Safari (macOS/iOS), Edge with HEVC extension, or re‑encode your streams to H.264.</p>
        </div>
      )}

      {/* Iframe embed */}
      {isIframe && currentServerUrl && !playerError && (
        <>
          {isVidnest && shieldVisible && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer touch-manipulation"
              onClick={handleShieldTap}
              style={{ pointerEvents: 'auto', touchAction: 'none' }}
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 shadow-2xl text-center select-none">
                <Play className="w-12 h-12 text-white mx-auto mb-2" />
                <p className="text-white text-sm font-bold">Tap to play</p>
                <p className="text-white/50 text-[10px] mt-1">(Use the video controls to pause, seek, etc.)</p>
              </div>
            </div>
          )}
          <iframe
            key={currentServerUrl}
            src={formatEmbedUrl(currentServerUrl)}
            className="absolute inset-0 w-full h-full"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            title={anime.title}
            onLoad={() => {}}
            {...(() => {
              const url = currentServerUrl.toLowerCase();
              const needsNoSandbox = url.includes('vidnest.fun') || url.includes('megaplay.buzz') || url.includes('vaplayer.ru');
              if (needsNoSandbox) {
                return {
                  style: {
                    pointerEvents: (isVidnest && (shieldVisible || !iframeEnabled)) ? 'none' : 'auto',
                  },
                };
              } else {
                return {
                  sandbox: "allow-scripts allow-same-origin allow-forms allow-presentation",
                };
              }
            })()}
          />
        </>
      )}

      {/* Native video */}
      {isNative && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain bg-black"
          playsInline
          webkit-playsinline="true"
          poster={anime.image}
          onTimeUpdate={() => {}}
          onLoadedMetadata={() => {}}
          onWaiting={() => {}}
          onPlaying={() => {}}
          onPause={() => {}}
          onEnded={() => {}}
          onError={() => {}}
          onCanPlay={() => {}}
          onClick={handleVideoTap}
          aria-label={`Video player for ${anime.title}`}
        />
      )}

      {/* No server selected */}
      {!currentServerUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <img src={anime.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="relative z-10 text-center">
            <Play className="w-16 h-16 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">Select a server to start watching</p>
          </div>
        </div>
      )}

      {/* Big play button overlay (native) */}
      {isNative && !playerLoading && !playerError && !isPlaying && currentServerUrl && (
        <button
          onClick={() => { handleInteraction(); togglePlay(); }}
          className="absolute inset-0 z-20 flex items-center justify-center transition-opacity hover:opacity-80 focus:outline-none touch-manipulation"
          aria-label="Play"
        >
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-4 sm:p-5 md:p-8 shadow-2xl border border-white/30">
            <Play className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 text-white fill-white drop-shadow-lg" />
          </div>
        </button>
      )}

      {/* Bottom controls (native) */}
      {isNative && currentServerUrl && !playerError && !codecWarning && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 sm:p-3 pt-8 sm:pt-12 transition-opacity duration-300 ${
            controlsVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={handleInteraction}
          onMouseEnter={handleInteraction}
        >
          <div ref={progressRef} className="w-full h-2 sm:h-1.5 bg-zinc-600/60 rounded-full cursor-pointer mb-2 sm:mb-3 relative group/progress" onClick={seekVideo}>
            <div className="absolute left-0 top-0 h-full bg-red-600 rounded-full" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 sm:w-3.5 sm:h-3.5 bg-red-500 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" style={{ left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 8px)` }} />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-1 sm:gap-2">
            <div className="flex items-center gap-1 sm:gap-3">
              <button onClick={() => { handleInteraction(); togglePlay(); }} className="text-white hover:text-red-400 p-1 touch-manipulation" aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause className="w-5 h-5 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-5 h-5 sm:w-5 sm:h-5 fill-current ml-0.5" />}
              </button>
              <button onClick={() => { handleInteraction(); skipTime(-10); }} className="text-white/80 hover:text-red-400 text-xs font-bold flex items-center gap-0.5 touch-manipulation" aria-label="Rewind 10 seconds">
                <RotateCcw className="w-4 h-4 inline" /> <span className="hidden xs:inline">10</span>
              </button>
              <button onClick={() => { handleInteraction(); skipTime(10); }} className="text-white/80 hover:text-red-400 text-xs font-bold flex items-center gap-0.5 touch-manipulation" aria-label="Forward 10 seconds">
                <span className="hidden xs:inline">10</span> <RotateCw className="w-4 h-4 inline" />
              </button>
              <button onClick={() => { handleInteraction(); toggleMute(); }} className="text-white/80 hover:text-red-400 p-1 touch-manipulation" aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}>
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => { handleInteraction(); changeVolume(e); }}
                className="w-16 sm:w-20 h-1 bg-zinc-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:rounded-full"
                aria-label="Volume"
              />
              <span className="text-[10px] sm:text-xs text-zinc-400 font-mono hidden xs:inline">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <select
                value={playbackRate}
                onChange={(e) => { handleInteraction(); changePlaybackRate(parseFloat(e.target.value)); }}
                className="bg-zinc-800 border border-zinc-700 rounded-md px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs text-white touch-manipulation"
                aria-label="Playback speed"
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => <option key={r} value={r}>{r}x</option>)}
              </select>
              <button onClick={() => { handleInteraction(); toggleFullscreen(); }} className="text-white/80 hover:text-red-400 p-1 touch-manipulation" aria-label="Fullscreen">
                <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ============================================================
// MAIN WATCH CONTENT
// ============================================================
function WatchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, selectedLanguage, setSelectedLanguage } = useApp();
  const animeId = searchParams.get('anime') || '0';
  const epNumber = searchParams.get('ep') ? parseInt(searchParams.get('ep')!) : null;

  const [anime, setAnime] = useState<Anime | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [allEpisodesData, setAllEpisodesData] = useState<RawEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'Overview' | 'Details'>('Overview');
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedServer, setSelectedServer] = useState('');
  const [serverSelections, setServerSelections] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [codecWarning, setCodecWarning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [recommendations, setRecommendations] = useState<Anime[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [shieldVisible, setShieldVisible] = useState(true);
  const [iframeEnabled, setIframeEnabled] = useState(false);
  const [showLoadingMsg, setShowLoadingMsg] = useState(false);
  const [showReportBtn, setShowReportBtn] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [episodeProgress, setEpisodeProgress] = useState<Record<number, number>>({});
  const [showBackButton, setShowBackButton] = useState(true);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoInitializedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const maxRetries = 3;
  const hasSavedHistory = useRef(false);
  const isRefreshing = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const shieldTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const iframeLoadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ---- Detect mobile ----
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ---- Back button auto‑hide ----
  const resetBackButtonTimeout = () => {
    setShowBackButton(true);
    if (backButtonTimeoutRef.current) clearTimeout(backButtonTimeoutRef.current);
    backButtonTimeoutRef.current = setTimeout(() => {
      setShowBackButton(false);
    }, 3000);
  };

  useEffect(() => {
    resetBackButtonTimeout();
    return () => {
      if (backButtonTimeoutRef.current) clearTimeout(backButtonTimeoutRef.current);
    };
  }, []);

  const handleInteraction = () => {
    resetBackButtonTimeout();
    resetControlsTimeout();
  };

  const handlePlayerHover = () => {
    setShowBackButton(true);
    if (backButtonTimeoutRef.current) clearTimeout(backButtonTimeoutRef.current);
  };

  const handlePlayerLeave = () => {
    if (backButtonTimeoutRef.current) clearTimeout(backButtonTimeoutRef.current);
    backButtonTimeoutRef.current = setTimeout(() => {
      setShowBackButton(false);
    }, 3000);
  };

  // ---- Timers for loading message and report ----
  useEffect(() => {
    if (playerLoading) {
      setShowLoadingMsg(false);
      setShowReportBtn(false);
      setReportSuccess(false);
      const msgTimer = setTimeout(() => setShowLoadingMsg(true), 15000);
      const reportTimer = setTimeout(() => setShowReportBtn(true), 60000);
      return () => {
        clearTimeout(msgTimer);
        clearTimeout(reportTimer);
      };
    }
  }, [playerLoading]);

  // ---- Report ----
  const reportBrokenLink = async (reason?: string) => {
    if (!anime || !episode || !currentServerUrl) return;
    setReporting(true);
    try {
      const serverName = Object.keys(servers).find(key => servers[key] === currentServerUrl) || selectedServer;
      await addDoc(collection(db, 'reports'), {
        animeId: anime.id,
        animeTitle: anime.title,
        episodeNumber: episode.number,
        serverName,
        url: currentServerUrl,
        userId: user?.id || null,
        reason: reason || 'User reported',
        createdAt: serverTimestamp(),
      });
      setReportSuccess(true);
      setTimeout(() => setReportSuccess(false), 4000);
    } catch (error) {
      console.error('Failed to report link:', error);
    } finally {
      setReporting(false);
    }
  };

  // ====== COMPUTED PROPERTIES ======
  const servers = useMemo(() => {
    if (!episode) return {};
    const lang = selectedLanguage;
    const episodeServers = episode.servers?.[lang] || {};
    return episodeServers;
  }, [selectedLanguage, episode]);

  const currentServerUrl = useMemo(() => servers[selectedServer] || '', [servers, selectedServer]);

  const isIframe = useMemo(() => {
    const url = currentServerUrl;
    if (!url) return false;
    const t = url.trim().toLowerCase();
    const embedDomains = [
      'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com',
      'drive.google.com', 'googleapis.com', 'ok.ru', 'streamtape.com',
      'mp4upload.com', 'vidcloud', 'gdrive', 'vidnest.fun', 'nxsha.app',
      'megaplay.buzz', 'vaplayer.ru'
    ];
    return embedDomains.some(domain => t.includes(domain));
  }, [currentServerUrl]);

  const isNative = useMemo(() => {
    const url = currentServerUrl;
    if (!url || isIframe) return false;
    const t = url.trim().toLowerCase();
    return /\.m3u8|\.mp4|\.webm|\.ogg|\.mkv/.test(t) || t.includes('m3u8');
  }, [currentServerUrl, isIframe]);

  const isVidnest = useMemo(() => {
    if (!currentServerUrl) return false;
    return currentServerUrl.toLowerCase().includes('vidnest.fun');
  }, [currentServerUrl]);

  // ---- Controls timeout (depends on isNative) ----
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isMobile && isNative && !playerLoading && !playerError && isPlaying) {
      setControlsVisible(true);
      controlsTimeoutRef.current = setTimeout(() => setControlsVisible(false), 2500);
    } else {
      setControlsVisible(true);
    }
  };

  useEffect(() => { resetControlsTimeout(); return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); }; }, [isMobile, isNative, playerLoading, playerError, isPlaying]);

  // ---- Video controls ----
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.readyState < 2) {
      setPlayerLoading(true);
      video.load();
      const playAttempt = () => {
        video.play().then(() => { setPlayerLoading(false); setIsPlaying(true); }).catch(() => { setPlayerLoading(false); setPlayerError('Unable to play. Please try another server.'); });
        video.removeEventListener('canplay', playAttempt);
      };
      video.addEventListener('canplay', playAttempt);
      return;
    }
    if (isPlaying) video.pause();
    else video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [isPlaying]);

  const seekVideo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const p = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    videoRef.current.currentTime = p * (videoRef.current.duration || 0);
  };

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || Infinity, videoRef.current.currentTime + seconds));
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; setIsMuted(v === 0); }
  };

  const changePlaybackRate = (rate: number) => { setPlaybackRate(rate); if (videoRef.current) videoRef.current.playbackRate = rate; };
  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else playerContainerRef.current.requestFullscreen();
  };

  const handleVideoTap = () => { handleInteraction(); togglePlay(); };

  // ---- Shared cache load ----
  useLayoutEffect(() => {
    if (!animeId || animeId === '0') {
      setLoading(false);
      setAnime(null);
      setFetchError(null);
      return;
    }

    // Check shared home cache first
    const cachedHome = getCachedHomeData();
    if (cachedHome && cachedHome.animeList && cachedHome.episodes) {
      const foundAnime = cachedHome.animeList.find((a: any) => a.id === animeId);
      if (foundAnime) {
        const eps = cachedHome.episodes
          .filter((e: any) => e.anime_id === animeId)
          .sort((a: any, b: any) => a.number - b.number)
          .map((e: any) => ({ ...e }));
        setAnime(foundAnime);
        setAllEpisodes(eps);
        setAllEpisodesData(eps);
        let selectedEp = null;
        if (epNumber) selectedEp = eps.find((e: any) => e.number === epNumber);
        if (!selectedEp && eps.length > 0) selectedEp = eps[0];
        setEpisode(selectedEp);
        setLoading(false);
        setFetchError(null);
        refreshData();
        return;
      }
    }

    // Fallback to watch cache
    const cachedWatch = getCachedWatchData(animeId);
    if (cachedWatch) {
      setAnime(cachedWatch.anime);
      setAllEpisodes(cachedWatch.allEpisodes);
      setRecommendations(cachedWatch.recommendations);
      setAllEpisodesData(cachedWatch.allEpisodesData || []);
      let selectedEp = null;
      if (epNumber) selectedEp = cachedWatch.allEpisodes.find((e: Episode) => e.number === epNumber);
      if (!selectedEp && cachedWatch.allEpisodes.length > 0) selectedEp = cachedWatch.allEpisodes[0];
      setEpisode(selectedEp);
      if (user) {
        setIsBookmarked(cachedWatch.bookmarkStatus);
        setUserRating(cachedWatch.userRating);
      }
      setLoading(false);
      setFetchError(null);
      refreshData();
    } else {
      refreshData();
    }

    const publicComments = getPublicCommentsCache(animeId);
    if (publicComments) setComments(publicComments);
  }, [animeId, epNumber, user]);

  // ---- Fetch episode progress ----
  useEffect(() => {
    if (!user || !animeId) return;
    const fetchProgress = async () => {
      const { data } = await supabase
        .from('watch_history')
        .select('last_episode, progress')
        .eq('user_id', user.id)
        .eq('anime_id', animeId)
        .single();
      if (data) {
        const prog: Record<number, number> = {};
        for (let i = 1; i <= data.last_episode; i++) {
          prog[i] = i === data.last_episode ? (data.progress || 0) : 100;
        }
        setEpisodeProgress(prog);
      }
    };
    fetchProgress();
  }, [user, animeId]);

  // ---- Rating fetch ----
  useEffect(() => {
    if (!user || !animeId || animeId === '0') return;
    const fetchRating = async () => {
      const { data } = await supabase
        .from('ratings')
        .select('rating')
        .eq('user_id', user.id)
        .eq('anime_id', animeId)
        .single();
      if (data) setUserRating(data.rating);
    };
    fetchRating();
  }, [animeId, user]);

  // ---- Refresh data ----
  const refreshData = async () => {
    if (!animeId || animeId === '0') { setLoading(false); return; }
    if (isRefreshing.current) return;
    isRefreshing.current = true;

    const timeoutId = setTimeout(() => {
      if (isRefreshing.current) {
        isRefreshing.current = false;
        setLoading(false);
        setFetchError('Data loading timed out. Please refresh the page.');
      }
    }, 15000);

    try {
      const [animeRes, episodesRes] = await Promise.all([
        CloudflareAPI.getAnime(),
        CloudflareAPI.getEpisodes(),
      ]);

      clearTimeout(timeoutId);

      let allAnime: RawAnime[] = animeRes?.anime || [];
      let allEpisodesRaw: RawEpisode[] = episodesRes?.episodes || [];

      setAllEpisodesData(allEpisodesRaw);

      const animeIdsWithLang = new Set<string>();
      if (selectedLanguage !== 'all') {
        allEpisodesRaw.forEach(ep => {
          if (ep.languages && ep.languages[selectedLanguage] && ep.languages[selectedLanguage].trim() !== '') {
            animeIdsWithLang.add(ep.anime_id);
          }
        });
      } else {
        allAnime.forEach(a => animeIdsWithLang.add(a.id));
      }

      const foundAnime = allAnime.find((a: RawAnime) => a.id === animeId);
      if (!foundAnime) {
        setAnime(null);
        setLoading(false);
        setFetchError(`Anime with ID ${animeId} not found.`);
        isRefreshing.current = false;
        return;
      }

      const animeData: Anime = {
        id: foundAnime.id,
        title: foundAnime.title,
        image: foundAnime.image,
        description: foundAnime.description,
        type: foundAnime.type,
        score: foundAnime.score,
        genre: foundAnime.genre,
        year: foundAnime.year,
        status: foundAnime.status,
        studio: foundAnime.studio,
        episodes: foundAnime.episodes,
      };

      setAnime(animeData);

      const eps: Episode[] = allEpisodesRaw
        .filter((e: RawEpisode) => e.anime_id === animeId)
        .sort((a: RawEpisode, b: RawEpisode) => a.number - b.number)
        .map((e: RawEpisode) => ({
          id: e.id,
          number: e.number,
          title: e.title,
          anime_id: e.anime_id,
          languages: e.languages,
          servers: e.servers,
        }));

      setAllEpisodes(eps);

      let selectedEp: Episode | null = null;
      if (epNumber) selectedEp = eps.find((e: Episode) => e.number === epNumber) || null;
      if (!selectedEp && eps.length > 0) selectedEp = eps[0];
      setEpisode(selectedEp);

      let recs: Anime[] = [];
      if (animeData.genre) {
        const genreList = animeData.genre.split(',').map(g => g.trim());
        recs = allAnime
          .filter((a: RawAnime) => a.id !== animeData.id && a.genre)
          .filter((a: RawAnime) => genreList.some(g => a.genre.includes(g)))
          .filter((a: RawAnime) => animeIdsWithLang.has(a.id))
          .slice(0, 8)
          .map((a: RawAnime) => ({
            id: a.id,
            title: a.title,
            image: a.image,
            description: a.description,
            type: a.type,
            score: a.score,
            genre: a.genre,
            year: a.year,
            status: a.status,
            studio: a.studio,
            episodes: a.episodes,
          }));
      }
      setRecommendations(recs);

      let bookmarkStatus = false;
      if (user) {
        const { data: bookmarkData } = await supabase
          .from('bookmarks')
          .select('anime_id')
          .eq('user_id', user.id)
          .eq('anime_id', animeId)
          .single();
        bookmarkStatus = !!bookmarkData;
      }
      setIsBookmarked(bookmarkStatus);

      try {
        const { data: commentsData } = await supabase
          .from('comments')
          .select('*')
          .eq('anime_id', animeId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (commentsData && commentsData.length > 0) {
          const freshComments = commentsData.map((c: any) => ({
            id: c.id,
            userId: c.user_id,
            username: c.username || 'User',
            avatar: c.avatar || (c.user_id ? c.user_id.toString().charAt(0).toUpperCase() : 'A'),
            text: c.text,
            timestamp: new Date(c.created_at).getTime(),
            likes: 0,
          }));
          setComments(freshComments);
          savePublicCommentsCache(animeId, freshComments);
        }
      } catch {}

      saveWatchCache(animeId, { anime: animeData, allEpisodes: eps, allEpisodesData: allEpisodesRaw, recommendations: recs, bookmarkStatus, userRating });
      saveToHomeCache(allAnime, allEpisodesRaw);

      setLoading(false);
      setFetchError(null);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error refreshing watch data:', error);
      setLoading(false);
      setFetchError('Failed to load anime data. Please check your connection.');
    } finally {
      isRefreshing.current = false;
    }
  };

  // ---- Language / Server selection ----
  useEffect(() => {
    if (!episode) return;
    const availableLanguages = Object.keys(episode.servers || {});
    let effectiveLang = selectedLanguage;
    if (availableLanguages.length === 0) {
      effectiveLang = 'ENG';
    } else {
      if (!episode.servers?.[effectiveLang] || Object.keys(episode.servers[effectiveLang]).length === 0) {
        effectiveLang = availableLanguages[0];
      }
    }
    if (effectiveLang !== selectedLanguage) setSelectedLanguage(effectiveLang);
    const langServers = episode.servers?.[effectiveLang] || {};
    const serverKeys = Object.keys(langServers);
    if (serverKeys.length > 0) {
      const saved = serverSelections[episode.id];
      if (saved && serverKeys.includes(saved)) setSelectedServer(saved);
      else setSelectedServer(serverKeys[0]);
    }
  }, [episode, selectedLanguage, setSelectedLanguage, serverSelections]);

  useEffect(() => {
    if (anime) refreshData();
  }, [selectedLanguage]);

  // ---- History reset ----
  useEffect(() => {
    hasSavedHistory.current = false;
  }, [episode?.id]);

  // ---- Episode switching ----
  const handleSelectEpisode = (ep: Episode) => {
    setPlayerLoading(false);
    setPlayerError('');
    setCurrentTime(0);
    setDuration(0);
    videoInitializedRef.current = false;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    setShieldVisible(true);
    setIframeEnabled(false);
    router.push(`/watch?anime=${anime?.id}&ep=${ep.number}`, { scroll: false });
  };

  const handleRate = async (star: number) => {
    if (!user) { alert('Please login to rate!'); return; }
    const rating = star * 2;
    setUserRating(rating);
    if (anime) {
      await supabase.from('ratings').upsert({
        user_id: user.id,
        anime_id: anime.id,
        rating: rating,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,anime_id' });
    }
  };

  const handleSubmitComment = async () => {
    if (!user) { router.push('/profile'); return; }
    if (!newComment.trim() || !anime) return;
    const commentText = newComment.trim();
    let commentId = Date.now();
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          user_id: user.id,
          anime_id: anime.id,
          text: commentText,
          username: user.email?.split('@')[0] || 'User',
          avatar: user.email?.charAt(0).toUpperCase() || 'A',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (!error && data) commentId = data.id;
    } catch (err) {}
    const newCommentObj = {
      id: commentId,
      userId: user.id,
      username: user.email?.split('@')[0] || 'User',
      avatar: user.email?.charAt(0).toUpperCase() || 'A',
      text: commentText,
      timestamp: Date.now(),
      likes: 0,
    };
    const updated = [newCommentObj, ...comments];
    setComments(updated);
    setNewComment('');
    savePublicCommentsCache(anime.id, updated);
  };

  const toggleBookmark = async () => {
    if (!user) { alert('Please login to bookmark!'); return; }
    if (!anime) return;
    const newState = !isBookmarked;
    setIsBookmarked(newState);
    if (newState) {
      await supabase.from('bookmarks').upsert({
        user_id: user.id,
        anime_id: anime.id,
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id,anime_id' });
    } else {
      await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('anime_id', anime.id);
    }
  };

  const handleShare = async () => {
    const epQuery = episode ? `&ep=${episode.number}` : '';
    const url = `${window.location.origin}/watch?anime=${anime?.id}${epQuery}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: anime?.title || 'AnimeTown',
          text: `Watch ${anime?.title}${episode ? ` Episode ${episode.number}` : ''} on AnimeTown!`,
          url: url,
        });
        return;
      } catch {}
    }
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleServerChange = (server: string) => {
    if (!episode) return;
    setSelectedServer(server);
    setServerSelections(prev => ({ ...prev, [episode.id]: server }));
  };

  const handleBack = () => router.back();

  // ---- History saving ----
  const saveHistoryAndStatus = async (ep: Episode) => {
    if (!user || !anime || hasSavedHistory.current) return;
    hasSavedHistory.current = true;

    const { data: existingHistory } = await supabase
      .from('watch_history')
      .select('last_episode')
      .eq('user_id', user.id)
      .eq('anime_id', anime.id)
      .maybeSingle();

    const isNewEpisode = !existingHistory || ep.number > existingHistory.last_episode;

    await supabase.from('watch_history').upsert({
      user_id: user.id,
      anime_id: anime.id,
      last_episode: ep.number,
      progress: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,anime_id' });

    if (isNewEpisode) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('episodes_watched, watch_time')
        .eq('id', user.id)
        .single();

      const newEpisodes = (profile?.episodes_watched || 0) + 1;
      const newWatchTime = (profile?.watch_time || 0) + 24;

      await supabase.from('profiles').upsert({
        id: user.id,
        episodes_watched: newEpisodes,
        watch_time: newWatchTime,
        last_watch_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    }

    const totalEpisodes = anime.episodes || allEpisodes.length;
    const newStatus: StatusType = ep.number >= totalEpisodes ? 'Completed' : 'Watching';

    await supabase.from('user_anime_status').upsert({
      user_id: user.id,
      anime_id: anime.id,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,anime_id' });
  };

  useEffect(() => {
    if (episode && anime) saveHistoryAndStatus(episode);
  }, [episode?.id, anime?.id]);

  // ---- Video event handlers (native) ----
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration || 0);
    setPlayerLoading(false);
    videoInitializedRef.current = true;
  };

  const handlePlaying = () => {
    setPlayerLoading(false);
    setIsPlaying(true);
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
  };

  const handlePause = () => setIsPlaying(false);
  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (anime && episode) {
      const nextEp = allEpisodes.find(e => e.number > episode.number);
      if (nextEp) handleSelectEpisode(nextEp);
    }
  };
  const handleWaiting = () => setPlayerLoading(true);
  const handleCanPlay = () => { setPlayerLoading(false); videoInitializedRef.current = true; };
  const handleVideoError = (e: any) => {
    const video = videoRef.current;
    if (!video) return;
    const error = video.error;
    if (error) {
      console.error('Video error:', error);
      if (error.code === 4 || error.code === 2) {
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          setPlayerError(`CORS or network error – retrying... (${retryCountRef.current}/${maxRetries})`);
          const proxied = getProxiedUrl(video.src);
          video.src = proxied;
          video.load();
        } else {
          setPlayerError('Unable to load video. Please try another server.');
          setPlayerLoading(false);
        }
      } else {
        setPlayerError(`Video error (code ${error.code}). Try another server.`);
        setPlayerLoading(false);
      }
    }
  };

  // ---- Video source management ----
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentServerUrl || !isNative) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    setPlayerLoading(true);
    setPlayerError('');
    setCodecWarning(false);
    setIsPlaying(false);
    videoInitializedRef.current = false;
    retryCountRef.current = 0;

    const url = currentServerUrl.trim();
    const proxiedUrl = getProxiedUrl(url);

    const loadVideo = (src: string) => {
      video.removeAttribute('src');
      video.load();
      video.src = src;
      video.load();
      loadingTimeoutRef.current = setTimeout(() => {
        if (!videoInitializedRef.current) {
          setPlayerLoading(false);
          setPlayerError('Video took too long to load. Please try another server.');
        }
        loadingTimeoutRef.current = null;
      }, 30000);
      video.muted = true;
      video.play().catch(() => {});
    };

    if (/\.m3u8($|\?)/i.test(proxiedUrl) || proxiedUrl.includes('m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 30,
          xhrSetup: (xhr, url) => {
            xhr.open('GET', getProxiedUrl(url), true);
            xhr.withCredentials = false;
            xhr.setRequestHeader('Origin', window.location.origin);
            xhr.setRequestHeader('Referer', window.location.origin);
          }
        });
        hls.loadSource(proxiedUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setPlayerLoading(false);
          videoInitializedRef.current = true;
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            if (retryCountRef.current < maxRetries) {
              retryCountRef.current++;
              setPlayerError(`Network error, retrying... (${retryCountRef.current}/${maxRetries})`);
              hls.destroy();
              hlsRef.current = null;
              loadVideo(getProxiedUrl(url));
            } else {
              let msg = 'An error occurred while loading the video.';
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) msg = 'Network error. Try another server.';
              else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) msg = 'Media error. Try another server.';
              setPlayerError(msg);
              setPlayerLoading(false);
              hls.destroy();
              hlsRef.current = null;
            }
          }
        });
        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        loadVideo(proxiedUrl);
      } else {
        setPlayerError('Your browser does not support HLS playback.');
        setPlayerLoading(false);
      }
    } else {
      loadVideo(proxiedUrl);
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [currentServerUrl, isNative]);

  // ---- Shield handler ----
  const handleShieldTap = () => {
    setShieldVisible(false);
    if (shieldTimeoutRef.current) clearTimeout(shieldTimeoutRef.current);
    shieldTimeoutRef.current = setTimeout(() => setIframeEnabled(true), 500);
  };

  // ---- Ad script ----
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).__adLoaded) {
      (window as any).__adLoaded = true;
      const script = document.createElement('script');
      script.src = 'https://ruffianattorneymargarine.com/22/f4/4b/22f44b1145190c5ab81771fa2f1f47da.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  // ---- Render ----
  if (loading) {
    return (
      <div className="min-h-screen bg-[#040406] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-[#040406] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <h1 className="text-xl font-bold text-white">Something went wrong</h1>
        <p className="text-sm text-zinc-400 max-w-md">{fetchError}</p>
        <button onClick={() => { setFetchError(null); setLoading(true); refreshData(); }} className="px-6 py-2 bg-red-600 rounded-lg text-sm font-bold text-white hover:bg-red-700 transition">Retry</button>
        <button onClick={handleBack} className="text-zinc-500 hover:text-white text-sm">Go back</button>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="min-h-screen bg-[#040406] flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-16 h-16 text-zinc-600" />
        <h1 className="text-xl font-bold text-white">Anime not found</h1>
        <button onClick={handleBack} className="text-red-500 hover:underline">Go back</button>
      </div>
    );
  }

  const availableLanguages = episode ? Object.keys(episode.servers || {}) : [];
  const currentServerKeys = episode && selectedLanguage ? Object.keys(episode.servers?.[selectedLanguage] || {}) : [];

  return (
    <div className="min-h-screen bg-[#040406] text-zinc-100 font-sans flex flex-col">
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8">
        {/* Video Player */}
        <VideoPlayer
          anime={anime}
          episode={episode}
          currentServerUrl={currentServerUrl}
          isNative={isNative}
          isIframe={isIframe}
          isVidnest={isVidnest}
          playerLoading={playerLoading}
          playerError={playerError}
          codecWarning={codecWarning}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          isMuted={isMuted}
          playbackRate={playbackRate}
          controlsVisible={controlsVisible}
          shieldVisible={shieldVisible}
          iframeEnabled={iframeEnabled}
          showBackButton={showBackButton}
          showLoadingMsg={showLoadingMsg}
          showReportBtn={showReportBtn}
          reportSuccess={reportSuccess}
          reporting={reporting}
          onBack={handleBack}
          togglePlay={togglePlay}
          skipTime={skipTime}
          toggleMute={toggleMute}
          changeVolume={changeVolume}
          changePlaybackRate={changePlaybackRate}
          toggleFullscreen={toggleFullscreen}
          seekVideo={seekVideo}
          handleVideoTap={handleVideoTap}
          handleInteraction={handleInteraction}
          handleShieldTap={handleShieldTap}
          reportBrokenLink={reportBrokenLink}
          videoRef={videoRef}
          progressRef={progressRef}
          playerContainerRef={playerContainerRef}
          onMouseEnter={handlePlayerHover}
          onMouseLeave={handlePlayerLeave}
        />

        {/* Action Bar */}
        <ActionBar
          anime={anime}
          episode={episode}
          isBookmarked={isBookmarked}
          onToggleBookmark={toggleBookmark}
          onShare={handleShare}
          onReport={() => reportBrokenLink('User reported')}
          reporting={reporting}
          reportSuccess={reportSuccess}
          availableLanguages={availableLanguages}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          currentServerKeys={currentServerKeys}
          selectedServer={selectedServer}
          onServerChange={handleServerChange}
        />

        {/* Episode List */}
        {allEpisodes.length > 1 && (
          <EpisodeList
            episodes={allEpisodes}
            currentEpisode={episode}
            onSelect={handleSelectEpisode}
            episodeProgress={episodeProgress}
          />
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6">
            <AnimeInfo
              anime={anime}
              episode={episode}
              userRating={userRating}
              hoverRating={hoverRating}
              setHoverRating={setHoverRating}
              onRate={handleRate}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
            <RecommendationsRow
              recommendations={recommendations}
              onSelect={(id: string) => router.push(`/watch?anime=${id}`)}
            />
          </div>

          {/* Comments */}
          <CommentSection
            user={user}
            comments={comments}
            newComment={newComment}
            setNewComment={setNewComment}
            onSubmit={handleSubmitComment}
            onLogin={() => router.push('/profile')}
          />
        </div>
      </main>
    </div>
  );
}

// ============================================================
// MAIN EXPORT
// ============================================================
export default function WatchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#040406] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <WatchContent />
    </Suspense>
  );
}