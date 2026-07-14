"use client";

import { useState, useEffect, useRef, useMemo, Suspense, useLayoutEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, Maximize, ArrowLeft,
  Share2, Star, Bookmark, Send,
  AlertCircle, Loader2, VolumeX, LogIn
} from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabaseClient';
import Hls from 'hls.js';

// ---------- FIRESTORE – exactly what you already have ----------
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
  if (trimmed.includes('vidnest.fun')) return trimmed;
  if (trimmed.includes('/embed/')) return trimmed;
  return trimmed;
}

// ============================================================
// CACHE HELPERS
// ============================================================
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
// WATCH CONTENT COMPONENT
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
  const [selectedTab, setSelectedTab] = useState<'native' | 'embed'>('native');
  const [controlsVisible, setControlsVisible] = useState(true);

  // ---------- loading message & report ----------
  const [showLoadingMsg, setShowLoadingMsg] = useState(false);
  const [showReportBtn, setShowReportBtn] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reporting, setReporting] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  // ---- Detect mobile ----
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ---- Timers for loading message and report button ----
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
    } else {
      setShowLoadingMsg(false);
      setShowReportBtn(false);
    }
  }, [playerLoading]);

  // ---- Report broken link ----
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
        reason: reason || 'Loading timeout',
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

  // ================================================================
  // COMPUTED PROPERTIES
  // ================================================================
  const servers = useMemo(() => {
    if (!episode) return {};
    const lang = selectedLanguage;
    const episodeServers = episode.servers?.[lang] || {};
    if (Object.keys(episodeServers).length === 0 && lang === 'ENG') {
      // Fallback test streams – remove in production if not needed
      return {
        'Big Buck Bunny (MP4)': 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
        'Mux HLS Test': 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      };
    }
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
      'mp4upload.com', 'vidcloud', 'gdrive', 'vidnest.fun', 'nxsha.app'
    ];
    return embedDomains.some(domain => t.includes(domain));
  }, [currentServerUrl]);

  const isNative = useMemo(() => {
    const url = currentServerUrl;
    if (!url || isIframe) return false;
    const t = url.trim().toLowerCase();
    return /\.m3u8|\.mp4|\.webm|\.ogg|\.mkv/.test(t) || t.includes('m3u8');
  }, [currentServerUrl, isIframe]);

  // ---- AUTO‑HIDE CONTROLS ----
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
  const handleInteraction = () => resetControlsTimeout();
  const handleVideoTap = () => { handleInteraction(); togglePlay(); };

  // ---- Video toggle ----
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.readyState < 2) {
      setPlayerLoading(true);
      video.load();
      const playAttempt = () => {
        video.play().then(() => { setPlayerLoading(false); setIsPlaying(true); }).catch((err) => {
          console.error('Play failed:', err);
          setPlayerLoading(false);
          setPlayerError('Unable to play. Please try another server.');
        });
        video.removeEventListener('canplay', playAttempt);
      };
      video.addEventListener('canplay', playAttempt);
      return;
    }
    if (isPlaying) {
      video.pause();
    } else {
      // Attempt to play, if autoplay blocked, we show an error or rely on user tap
      video.play().then(() => setIsPlaying(true)).catch((err) => {
        console.error('Play failed:', err);
        // In case autoplay is blocked, we just remain paused – user can tap again
        setIsPlaying(false);
      });
    }
  }, [isPlaying]);

  // ---- Video event handlers ----
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
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ================================================================
  // INSTANT CACHE LOAD + BACKGROUND REFRESH
  // ================================================================
  useLayoutEffect(() => {
    if (!animeId || animeId === '0') {
      setLoading(false);
      setAnime(null);
      setFetchError(null);
      return;
    }

    const cached = getCachedWatchData(animeId);
    if (cached) {
      setAnime(cached.anime);
      setAllEpisodes(cached.allEpisodes);
      setRecommendations(cached.recommendations);
      setAllEpisodesData(cached.allEpisodesData || []);

      let selectedEp = null;
      if (epNumber) {
        selectedEp = cached.allEpisodes.find((e: Episode) => e.number === epNumber);
      }
      if (!selectedEp && cached.allEpisodes.length > 0) {
        selectedEp = cached.allEpisodes[0];
      }
      setEpisode(selectedEp);

      if (user) {
        setIsBookmarked(cached.bookmarkStatus);
        setUserRating(cached.userRating);
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

  // ---- Dedicated rating fetch ----
  useEffect(() => {
    if (!user || !animeId || animeId === '0') return;
    const fetchRating = async () => {
      const { data, error } = await supabase
        .from('ratings')
        .select('rating')
        .eq('user_id', user.id)
        .eq('anime_id', animeId)
        .single();
      if (data) setUserRating(data.rating);
      else setUserRating(0);
    };
    fetchRating();
  }, [animeId, user]);

  // ================================================================
  // REFRESH DATA
  // ================================================================
  const refreshData = async () => {
    if (!animeId || animeId === '0') {
      setLoading(false);
      return;
    }
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
      const fetchPromise = Promise.all([
        fetch('/api/anime').then(r => r.json()),
        fetch('/api/episodes').then(r => r.json()),
      ]);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), 15000)
      );

      const [animeRes, episodesRes] = await Promise.race([fetchPromise, timeoutPromise]) as any[];

      clearTimeout(timeoutId);

      let allAnime: RawAnime[] = animeRes?.anime || [];
      let allEpisodesRaw: RawEpisode[] = episodesRes?.episodes || [];

      // Save full episodes data for language filtering later
      setAllEpisodesData(allEpisodesRaw);

      // Build list of anime IDs that have at least one episode in the selected language
      const animeIdsWithLang = new Set<string>();
      if (selectedLanguage !== 'all') {
        allEpisodesRaw.forEach(ep => {
          if (ep.languages && ep.languages[selectedLanguage] && ep.languages[selectedLanguage].trim() !== '') {
            animeIdsWithLang.add(ep.anime_id);
          }
        });
      } else {
        // All languages: all anime are allowed
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

      setAnime(prev => {
        if (JSON.stringify(prev) === JSON.stringify(animeData)) return prev;
        return animeData;
      });

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

      setAllEpisodes(prev => {
        if (JSON.stringify(prev) === JSON.stringify(eps)) return prev;
        return eps;
      });

      let selectedEp: Episode | null = null;
      if (epNumber) {
        selectedEp = eps.find((e: Episode) => e.number === epNumber) || null;
      }
      if (!selectedEp && eps.length > 0) {
        selectedEp = eps[0];
      }
      setEpisode(selectedEp);

      // Recommendations – filtered by genre AND language availability
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

      // Bookmark status
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

      saveWatchCache(animeId, {
        anime: animeData,
        allEpisodes: eps,
        allEpisodesData: allEpisodesRaw,
        recommendations: recs,
        bookmarkStatus,
        userRating: userRating,
      });

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

  // ---- Background data fetch (only if no cache) ----
  useEffect(() => {
    if (!animeId || animeId === '0') return;
    const cached = getCachedWatchData(animeId);
    if (!cached) {
      refreshData();
    }
  }, [animeId]);

  // ---- Recalculate recommendations when language changes ----
  useEffect(() => {
    if (anime) {
      refreshData();
    }
  }, [selectedLanguage]);

  // ---- Set default server & language fallback ----
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

    if (effectiveLang !== selectedLanguage) {
      setSelectedLanguage(effectiveLang);
    }

    const langServers = episode.servers?.[effectiveLang] || {};
    const serverKeys = Object.keys(langServers);
    if (serverKeys.length > 0) {
      setSelectedServer(serverKeys[0]);
      setSelectedTab('native');
    }
  }, [episode, selectedLanguage, setSelectedLanguage]);

  // ---- Helpers ----
  const getAvailableLanguages = () => {
    if (!episode) return [];
    return Object.keys(episode.servers || {});
  };

  const getServersForLanguage = (lang: string) => {
    if (!episode) return {};
    const servers = episode.servers?.[lang] || {};
    if (Object.keys(servers).length === 0 && lang === 'ENG') {
      return {
        'Big Buck Bunny (MP4)': 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
        'Mux HLS Test': 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      };
    }
    return servers;
  };

  const handleBack = () => router.back();

  const handleSelectEpisode = (ep: Episode) => {
    setPlayerLoading(false);
    setPlayerError('');
    setCurrentTime(0);
    setDuration(0);
    videoInitializedRef.current = false;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    router.push(`/watch?anime=${anime?.id}&ep=${ep.number}`, { scroll: false });
  };

  const handleRate = async (star: number) => {
    if (!user) {
      alert('Please login to rate!');
      return;
    }
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
    if (!user) {
      router.push('/profile');
      return;
    }
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

  // ---- Video event handlers ----
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration || 0);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    setPlayerLoading(false);
    videoInitializedRef.current = true;
  };

  const handlePlaying = () => {
    setPlayerLoading(false);
    setIsPlaying(true);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    handlePlayStart();
  };

  const handlePause = () => setIsPlaying(false);

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (anime && episode) {
      const nextEp = allEpisodes.find(e => e.number > episode.number);
      if (nextEp) handleSelectEpisode(nextEp);
    }
  };

  const handleWaiting = () => {
    setPlayerLoading(true);
  };

  const handleCanPlay = () => {
    setPlayerLoading(false);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    videoInitializedRef.current = true;
  };

  // ========================================================================
  // FIXED: increment stats only when a new episode is started
  // ========================================================================
  const saveHistoryAndStatus = async (ep: Episode) => {
    if (!user || !anime) return;
    if (hasSavedHistory.current) return;
    hasSavedHistory.current = true;

    const { data: existingHistory, error: fetchError } = await supabase
      .from('watch_history')
      .select('last_episode')
      .eq('user_id', user.id)
      .eq('anime_id', anime.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching watch history:', fetchError);
    }

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

    if (typeof window !== 'undefined') {
      const myListCacheKey = `myListCache_${user.id}`;
      const cached = localStorage.getItem(myListCacheKey);
      let listData = cached
        ? JSON.parse(cached)
        : { animeList: [], watchlist: [], statuses: {} };

      listData.statuses = {
        ...(listData.statuses || {}),
        [anime.id]: newStatus,
      };

      if (isBookmarked && !listData.watchlist.some((w: any) => w.id === anime.id)) {
        listData.watchlist.push({
          id: anime.id,
          title: anime.title,
          image: anime.image,
          type: anime.type,
        });
      }

      localStorage.setItem(myListCacheKey, JSON.stringify(listData));
    }

    if (typeof window !== 'undefined') {
      const cwKey = `homeCW_${user.id}`;
      const cached = localStorage.getItem(cwKey);
      let arr = cached ? JSON.parse(cached) : [];
      arr = arr.filter((w: any) => w.anime_id !== anime.id);
      arr.push({
        anime_id: anime.id,
        last_episode: ep.number,
        updated_at: new Date().toISOString(),
        progress: 0,
      });
      localStorage.setItem(cwKey, JSON.stringify(arr));
    }
  };

  useEffect(() => {
    if (episode && anime) {
      hasSavedHistory.current = false;
      saveHistoryAndStatus(episode);
    }
  }, [episode?.id, anime?.id]);

  const handlePlayStart = () => {
    if (user && anime && episode) {
      hasSavedHistory.current = false;
      saveHistoryAndStatus(episode);
    }
  };

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'KeyF') { e.preventDefault(); toggleFullscreen(); }
      if (e.code === 'KeyM') { e.preventDefault(); toggleMute(); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); skipTime(-10); }
      if (e.code === 'ArrowRight') { e.preventDefault(); skipTime(10); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay]);

  // ================================================================
  // PLAYER SOURCE MANAGEMENT
  // ================================================================
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentServerUrl || !isNative) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }

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

      // Mute before autoplay to avoid policy restrictions, then user can unmute
      video.muted = true;
      video.play()
        .then(() => {
          // Once playing, unmute if the user didn't previously mute
          if (!isMuted) {
            video.muted = false;
          }
        })
        .catch((err) => {
          console.log('Autoplay prevented:', err);
          setPlayerLoading(false);
        });
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
              const retryUrl = getProxiedUrl(url);
              loadVideo(retryUrl);
            } else {
              let msg = 'An error occurred while loading the video.';
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                msg = 'Network error. Try another server or check your connection.';
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                msg = 'Media error. Try another server.';
              }
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
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [currentServerUrl, isNative]);

  const handleVideoError = (e: any) => {
    const video = videoRef.current;
    if (!video) return;
    const error = video.error;
    if (error) {
      console.error('Video error:', error);
      if (error.code === 4 || error.code === 2) {
        const currentSrc = video.src;
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          setPlayerError(`CORS or network error – retrying... (${retryCountRef.current}/${maxRetries})`);
          const proxied = getProxiedUrl(currentSrc);
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

  // ================================================================
  // RENDER – Loading state (simple spinner)
  // ================================================================
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
        <button
          onClick={() => {
            setFetchError(null);
            setLoading(true);
            refreshData();
          }}
          className="px-6 py-2 bg-red-600 rounded-lg text-sm font-bold text-white hover:bg-red-700 transition"
        >
          Retry
        </button>
        <button onClick={handleBack} className="text-zinc-500 hover:text-white text-sm">
          Go back
        </button>
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

  const showPlayOverlay = currentServerUrl && !playerLoading && !playerError && !isPlaying;

  return (
    <div className="min-h-screen bg-[#040406] text-zinc-100 font-sans flex flex-col">
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="group p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-white truncate">{anime.title}</h1>
            <p className="text-xs text-zinc-500">Episode {episode?.number ?? '?'} – {episode?.title ?? 'Select an episode'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleBookmark} className={`p-2 rounded-lg ${isBookmarked ? 'text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/30' : 'text-zinc-400 hover:text-amber-400 hover:bg-zinc-800'}`}>
              <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
            <button onClick={handleShare} className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Player */}
        <div 
          ref={playerContainerRef} 
          className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl"
          onMouseMove={handleInteraction}
          onTouchStart={handleInteraction}
        >
          {/* Loading Overlay – simplified spinner */}
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
                  className="mt-3 px-4 py-2 bg-red-600/20 border border-red-500/30 rounded-lg text-xs text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {reporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '⚠️'} Report broken link
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
                <button onClick={() => { setPlayerError(''); setPlayerLoading(false); }} className="px-4 py-2 bg-red-600 rounded-lg text-xs font-bold text-white hover:bg-red-700">Retry</button>
                {!reportSuccess ? (
                  <button
                    onClick={() => reportBrokenLink(playerError)}
                    disabled={reporting}
                    className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 flex items-center gap-2"
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
            <iframe
              src={formatEmbedUrl(currentServerUrl)}
              className="absolute inset-0 w-full h-full"
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture"
              title={anime.title}
              onLoad={() => setPlayerLoading(false)}
              {...(currentServerUrl.toLowerCase().includes('vidnest.fun')
                ? {}
                : { sandbox: "allow-scripts allow-same-origin allow-forms allow-presentation" }
              )}
            />
          )}

          {/* Native video */}
          {isNative && (
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-contain bg-black"
              playsInline
              webkit-playsinline="true"
              poster={anime.image}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onWaiting={handleWaiting}
              onPlaying={handlePlaying}
              onPause={handlePause}
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              onCanPlay={handleCanPlay}
              onClick={handleVideoTap}
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

          {/* Big play button overlay */}
          {isNative && showPlayOverlay && (
            <button
              onClick={() => { handleInteraction(); togglePlay(); }}
              className="absolute inset-0 z-20 flex items-center justify-center transition-opacity hover:opacity-80 focus:outline-none"
              aria-label="Play"
            >
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-4 sm:p-5 md:p-8 shadow-2xl border border-white/30">
                <Play className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 text-white fill-white drop-shadow-lg" />
              </div>
              {isMobile && !isPlaying && <span className="absolute bottom-8 text-xs text-white/50">Tap to play</span>}
            </button>
          )}

          {/* Bottom controls */}
          {isNative && currentServerUrl && !playerError && !codecWarning && (
            <div 
              className={`
                absolute bottom-0 left-0 right-0 z-20 
                bg-gradient-to-t from-black/90 via-black/50 to-transparent 
                p-3 pt-10 sm:p-4 sm:pt-12
                transition-opacity duration-300
                ${isMobile ? (controlsVisible ? 'opacity-100' : 'opacity-0') : 'opacity-0 hover:opacity-100'}
              `}
              onClick={handleInteraction}
              onMouseEnter={handleInteraction}
            >
              <div ref={progressRef} className="w-full h-2 sm:h-1.5 bg-zinc-600/60 rounded-full cursor-pointer mb-3 relative group/progress" onClick={seekVideo}>
                <div className="absolute left-0 top-0 h-full bg-red-600 rounded-full" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 sm:w-3.5 sm:h-3.5 bg-red-500 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" style={{ left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 8px)` }} />
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button onClick={() => { handleInteraction(); togglePlay(); }} className="text-white hover:text-red-400 p-1">
                    {isPlaying ? <Pause className="w-5 h-5 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-5 h-5 sm:w-5 sm:h-5 fill-current ml-0.5" />}
                  </button>
                  <button onClick={() => { handleInteraction(); skipTime(-10); }} className="text-white/80 hover:text-red-400 text-xs font-bold flex items-center gap-0.5"><RotateCcw className="w-4 h-4 inline" /> 10</button>
                  <button onClick={() => { handleInteraction(); skipTime(10); }} className="text-white/80 hover:text-red-400 text-xs font-bold flex items-center gap-0.5">10 <RotateCw className="w-4 h-4 inline" /></button>
                  <button onClick={() => { handleInteraction(); toggleMute(); }} className="text-white/80 hover:text-red-400 p-1">
                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                  {!isMobile && (
                    <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={(e) => { handleInteraction(); changeVolume(e); }} className="w-16 sm:w-20 h-1 bg-zinc-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:rounded-full" />
                  )}
                  <span className="text-xs text-zinc-400 font-mono hidden xs:inline">{formatTime(currentTime)} / {formatTime(duration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select value={playbackRate} onChange={(e) => { handleInteraction(); changePlaybackRate(parseFloat(e.target.value)); }} className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => <option key={r} value={r}>{r}x</option>)}
                  </select>
                  <button onClick={() => { handleInteraction(); toggleFullscreen(); }} className="text-white/80 hover:text-red-400 p-1"><Maximize className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Episode Grid – only if there's more than one episode */}
        {allEpisodes.length > 1 && (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-64 overflow-y-auto pr-2">
            {allEpisodes.map((ep) => (
              <button
                key={ep.id}
                onClick={() => handleSelectEpisode(ep)}
                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                  ep.number === episode?.number
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                {ep.number}
              </button>
            ))}
          </div>
        )}

        {/* Content: Tabs on left, Comments on right (desktop) – equal height, scrollable */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left side – Overview/Details */}
          <div className="lg:col-span-2">
            <div className="max-h-[500px] overflow-y-auto pr-1 space-y-6">
              {/* Tabs */}
              <div className="flex gap-6 border-b border-zinc-800 pb-2">
                {['Overview', 'Details'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`text-xs font-black pb-2 relative whitespace-nowrap transition-colors ${activeTab === tab ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {tab}
                    {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-full" />}
                  </button>
                ))}
              </div>

              {activeTab === 'Overview' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h1 className="text-2xl font-black text-white">{anime.title}</h1>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400">
                        <span>{anime.year}</span><span>•</span><span>{anime.type}</span><span>•</span><span>Ep {episode?.number ?? '?'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <button key={s} onMouseEnter={() => setHoverRating(s*2)} onMouseLeave={() => setHoverRating(0)} onClick={() => handleRate(s)}>
                            <Star className={`w-5 h-5 ${(hoverRating || userRating) >= s*2 ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'}`} />
                          </button>
                        ))}
                      </div>
                      <span className="text-xs text-zinc-500">
                        {userRating > 0 ? `Your rating: ${userRating}/10` : 'Rate this anime'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{anime.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {anime.genre.split(',').map(g => (
                      <span key={g} className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-800/50 text-zinc-400">
                        {g.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'Details' && (
                <div className="space-y-3 text-xs text-zinc-400">
                  <div className="grid grid-cols-2 gap-2 text-zinc-500">
                    <div>Studio: <span className="text-zinc-300">{anime.studio || 'Unknown'}</span></div>
                    <div>Status: <span className="text-red-500">{anime.status || '?'}</span></div>
                    <div>Episodes: <span className="text-zinc-300">{anime.episodes || allEpisodes.length}</span></div>
                    <div>Score: <span className="text-amber-400">★ {anime.score || '?'}</span></div>
                  </div>
                  <p>{anime.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar – Comments (first 4, rest scrollable) */}
          <div className="lg:col-span-1">
            <div className="max-h-[500px] overflow-y-auto pr-1 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Comments</h3>
              {user ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                  />
                  <button onClick={handleSubmitComment} className="bg-red-600 px-3 py-2 rounded-lg text-white text-xs font-bold"><Send className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <button
                  onClick={() => router.push('/profile')}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-2.5 text-xs font-bold text-zinc-400 hover:text-red-400 hover:border-red-500/50 flex items-center justify-center gap-2 transition-all"
                >
                  <LogIn className="w-3.5 h-3.5" /> Login to comment
                </button>
              )}
              {/* Scrollable comment list inside the same max-h container */}
              <div className="space-y-3">
                {comments.slice(0, 4).map(c => (
                  <div key={c.id} className="space-y-1.5 pb-3 border-b border-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-purple-500 rounded-full text-[10px] font-black flex items-center justify-center">{c.avatar}</div>
                      <span className="text-xs font-bold text-zinc-200">{c.username}</span>
                      <span className="text-[9px] text-zinc-500">{new Date(c.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-zinc-400 pl-8">{c.text}</p>
                  </div>
                ))}
                {comments.length > 4 &&
                  comments.slice(4).map(c => (
                    <div key={c.id} className="space-y-1.5 pb-3 border-b border-zinc-800/50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-purple-500 rounded-full text-[10px] font-black flex items-center justify-center">{c.avatar}</div>
                        <span className="text-xs font-bold text-zinc-200">{c.username}</span>
                        <span className="text-[9px] text-zinc-500">{new Date(c.timestamp).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-zinc-400 pl-8">{c.text}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* You May Also Like – full width bottom (desktop and mobile) */}
        {recommendations.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">You May Also Like</h3>
            <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
              {recommendations.slice(0, 8).map(rec => (
                <div
                  key={rec.id}
                  className="flex-shrink-0 w-[120px] cursor-pointer group"
                  onClick={() => router.push(`/watch?anime=${rec.id}`)}
                >
                  <div className="aspect-[3/4] bg-zinc-900 rounded-lg overflow-hidden mb-2">
                    <img src={rec.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt={rec.title} />
                  </div>
                  <h4 className="text-[10px] font-bold truncate text-zinc-200 group-hover:text-red-400">{rec.title}</h4>
                  <p className="text-[9px] text-zinc-500">{rec.type} • ★ {rec.score}</p>
                </div>
              ))}
            </div>
          </div>
        )}
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