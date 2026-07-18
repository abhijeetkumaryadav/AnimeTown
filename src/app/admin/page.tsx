"use client";

import { useState, useEffect } from 'react';
import {
  Film, Tv, Video, Calendar, Star, Globe, Settings,
  Plus, Edit, Trash2, Save, X, Search, Play, Download,
  Upload, Link as LinkIcon, Image as ImageIcon, Hash, Type, AlignLeft, Tag,
  Users, Lock, LogOut, Monitor, Zap,
  RefreshCw, FolderOpen, BarChart3,
  Clock, Eye, Heart, Bookmark,
  ChevronDown, ChevronRight, ArrowLeft, ArrowRight,
  MoreVertical, Filter, Grid3x3, List,
  Sparkles, Wand2, Terminal,
  Activity, Gauge, Shield, AlertCircle, Check,
  ExternalLink, Copy, Clipboard, CheckCircle2, XCircle, AlertTriangle,
  Newspaper, Send, Database, Cloud, Server, ServerCrash,
  Flag, Gift, Server as ServerIcon, LayoutDashboard
} from 'lucide-react';
import { combinedSearch, apiResultToAnime, getAniListTrending, getJikanTop, getJikanSeasonal, fetchAnimeNews } from '@/lib/animeApis';
import { CloudflareAPI } from '@/lib/db-client';

// ---------- FIRESTORE (only for reports & FCM) ----------
import { db } from '@/lib/firebaseClient';
import { collection, query, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const NAV_ITEMS = [
  { id: 'import', label: 'Import', icon: Download, color: '#f59e0b' },
  { id: 'episodes', label: 'Episodes', icon: Video, color: '#8b5cf6' },
  { id: 'schedule', label: 'Schedule', icon: Calendar, color: '#06b6d4' },
  { id: 'sliders', label: 'Sliders', icon: LayoutDashboard, color: '#8b5cf6' },
  { id: 'news', label: 'News', icon: Newspaper, color: '#10b981' },
  { id: 'content', label: 'Content', icon: FolderOpen, color: '#8b5cf6' },
];

const ALL_GENRES = [
  "Action", "Adult", "Adult Cast", "Adventure", "Animation", "Anthropomorphic", "Award Winning", "Boys Love",
  "Comedy", "Crime", "Crossdressing", "Delinquents", "Drama", "Ecchi", "Family", "Fantasy", "Girls Love", "Gore",
  "Gourmet", "Harem", "Hentai", "High Stakes Game", "Historical", "Horror", "Isekai", "Josei", "Love Polygon",
  "Magical Sex Shift", "Martial Arts", "Mecha", "Medical", "Military", "Music", "Mystery", "Mythology", "Otaku Culture",
  "Parody", "Psychological", "Racing", "Reincarnation", "Romance", "Samurai", "School", "Sci-Fi", "Seinen", "Shoujo",
  "Shounen", "Sports", "Strategy Game", "Super Power", "Supernatural", "Survival", "Suspense", "Thriller", "Time Travel",
  "Urban Fantasy", "Vampire", "Video Game"
];

const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  'jap': 'Japanese',
  'eng': 'English',
  'hin': 'Hindi',
  'tel': 'Telugu',
  'tam': 'Tamil',
  'kan': 'Kannada',
  'mal': 'Malayalam',
  'spa': 'Spanish',
  'fre': 'French',
  'ger': 'German',
  'kor': 'Korean',
  'chi': 'Chinese',
  'ara': 'Arabic',
  'por': 'Portuguese',
  'rus': 'Russian',
};

const LANGUAGE_DISPLAY_TO_CODE: Record<string, string> = {};
Object.entries(LANGUAGE_DISPLAY_NAMES).forEach(([code, name]) => {
  LANGUAGE_DISPLAY_TO_CODE[name] = code;
});

// ============================================================
//   HELPER FUNCTIONS
// ============================================================
const getLanguageDisplay = (key: string) => {
  return LANGUAGE_DISPLAY_NAMES[key] || key;
};

const getLanguageKeyFromDisplay = (displayName: string) => {
  return LANGUAGE_DISPLAY_TO_CODE[displayName] || displayName;
};

// ============================================================
//   HELPER FOR REPORT COUNT
// ============================================================
const getReportCountForAnime = (animeId: string, reports: any[]) => {
  return reports.filter(r => r.animeId === animeId).length;
};

export default function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeSection, setActiveSection] = useState('import');
  const [notification, setNotification] = useState<{ msg: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [animeList, setAnimeList] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [scheduleItems, setScheduleItems] = useState<any[]>([]);
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [newlyAddedIds, setNewlyAddedIds] = useState<string[]>([]);

  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Import tabs
  const [importTab, setImportTab] = useState<'api' | 'vidnest' | 'nxsha' | 'anikoto'>('api');
  const [importQuery, setImportQuery] = useState('');
  const [importResults, setImportResults] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Vidnest specific
  const [vidnestQuery, setVidnestQuery] = useState('');
  const [vidnestResults, setVidnestResults] = useState<any[]>([]);
  const [vidnestLoading, setVidnestLoading] = useState(false);
  const [selectedVidnestType, setSelectedVidnestType] = useState<'anime' | 'animepahe'>('anime');

  // Nxsha specific
  const [nxshaQuery, setNxshaQuery] = useState('');
  const [nxshaResults, setNxshaResults] = useState<any[]>([]);
  const [nxshaLoading, setNxshaLoading] = useState(false);
  const [nxshaSeason, setNxshaSeason] = useState(1);
  const [nxshaLanguage, setNxshaLanguage] = useState('hin');

  // Anikoto specific
  const [anikotoQuery, setAnikotoQuery] = useState('');
  const [anikotoResults, setAnikotoResults] = useState<any[]>([]);
  const [anikotoLoading, setAnikotoLoading] = useState(false);
  const [anikotoLanguage, setAnikotoLanguage] = useState('sub');

  // Sliders
  const [slidersTab, setSlidersTab] = useState<'featured' | 'newlyAdded'>('featured');
  const [sliderSearch, setSliderSearch] = useState('');

  // Episode manager
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [selectedAnimeForEp, setSelectedAnimeForEp] = useState<any>(null);
  const [episodeForm, setEpisodeForm] = useState({
    number: 1,
    title: '',
    language: 'jap',
    serverName: 'Server 1',
    link: ''
  });
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);

  const [addServerForm, setAddServerForm] = useState<{ episodeId: string | null, language: string, serverName: string, link: string }>({
    episodeId: null,
    language: 'jap',
    serverName: '',
    link: ''
  });

  const [serverManagementModal, setServerManagementModal] = useState<{
    episode: any;
    animeTitle: string;
  } | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    day: 1,
    time: '18:00',
    title: '',
    episode: 1,
    link: '',
    anime_id: null as any,
  });
  const [editingSchedule, setEditingSchedule] = useState<any>(null);

  const [newsForm, setNewsForm] = useState({ title: '', content: '', image: '', status: 'draft' });
  const [editingNews, setEditingNews] = useState<any>(null);

  const [contentSearch, setContentSearch] = useState('');
  const [contentLang, setContentLang] = useState<string | null>(null);
  const [contentGenre, setContentGenre] = useState<string>('All');
  const [contentType, setContentType] = useState<string>('All');

  const [editAnimeModal, setEditAnimeModal] = useState<any>(null);
  const [editAnimeForm, setEditAnimeForm] = useState<any>({});

  const [quickEditEp, setQuickEditEp] = useState<{ animeId: string; epNumber: number } | null>(null);
  const [quickEditUrl, setQuickEditUrl] = useState('');

  // ==================== NOTIFICATION ====================
  const showNotification = (msg: string, type: string = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ==================== LOGIN ====================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      // ✅ Use Cloudflare Worker endpoint
      const res = await fetch('https://anime-cms.animetown.workers.dev/api/check-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setIsLoggedIn(true);
      } else {
        setLoginError('Invalid password');
        setPassword('');
      }
    } catch (err) {
      setLoginError('Network error. Please try again.');
    }
    setLoginLoading(false);
  };

  // ==================== LOAD REPORTS (Firestore) ====================
  const loadReports = async () => {
    setReportsLoading(true);
    try {
      const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReports(reportsData);
    } catch (error) {
      console.error('Failed to load reports:', error);
      showNotification('Failed to load reports. Check Firestore rules.', 'error');
    } finally {
      setReportsLoading(false);
    }
  };

  const deleteReport = async (reportId: string) => {
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setReports(prev => prev.filter(r => r.id !== reportId));
      showNotification('Report removed.');
    } catch (error) {
      console.error('Delete failed:', error);
      showNotification('Failed to delete report.', 'error');
    }
  };

  // ==================== LOAD ALL DATA (Cloudflare) ====================
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [animeRes, episodesRes, scheduleRes, newsRes, featuredRes, newlyAddedRes] = await Promise.all([
        CloudflareAPI.getAnime(),
        CloudflareAPI.getEpisodes(),
        CloudflareAPI.getSchedule(),
        CloudflareAPI.getNews(),
        CloudflareAPI.getFeatured(),
        CloudflareAPI.getNewlyAdded(),
      ]);
      const animeArr = Array.isArray(animeRes.anime) ? animeRes.anime : [];
      const episodeArr = Array.isArray(episodesRes.episodes) ? episodesRes.episodes : [];
      setAnimeList(animeArr);
      setEpisodes(episodeArr);
      setScheduleItems(Array.isArray(scheduleRes.schedule) ? scheduleRes.schedule : []);
      setNewsItems(Array.isArray(newsRes.news) ? newsRes.news : []);
      setFeaturedIds(Array.isArray(featuredRes.featured) ? featuredRes.featured : []);
      setNewlyAddedIds(Array.isArray(newlyAddedRes.newlyAdded) ? newlyAddedRes.newlyAdded : []);
    } catch (err) {
      showNotification('Failed to load data!', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadAllData();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (activeSection === 'content') {
      loadReports();
    }
  }, [activeSection]);

  // ==================== HELPERS ====================
  const dedupeResults = (results: any[]) => {
    const seen = new Set();
    return results.filter((item: any) => {
      const key = `${item.title?.toLowerCase().trim()}_${item.mal_id || item.anilist_id || item.kitsu_id || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const enrichWithFullSynopsis = async (item: any) => {
    if (item.mal_id) {
      try {
        const res = await fetch(`https://api.jikan.moe/v4/anime/${item.mal_id}/full`);
        const data = await res.json();
        if (data?.data?.synopsis) {
          return { ...item, synopsis: data.data.synopsis };
        }
      } catch (e) { /* ignore */ }
    }
    return item;
  };

  // ==================== EDIT ANIME ====================
  const openEditAnime = (anime: any) => {
    setEditAnimeModal(anime);
    setEditAnimeForm({ ...anime });
  };

  const saveAnimeEdit = async () => {
    try {
      await CloudflareAPI.putAnime(editAnimeForm);
      setAnimeList(prev => prev.map((a: any) => a.id === editAnimeForm.id ? { ...a, ...editAnimeForm } : a));
      setEditAnimeModal(null);
      showNotification('Anime updated!');
    } catch (err) {
      showNotification('Failed to update!', 'error');
    }
  };

  // ==================== IMPORT ====================
  const handleApiSearch = async () => {
    if (!importQuery.trim()) return;
    setIsImporting(true);
    try {
      const results = await combinedSearch(importQuery);
      setImportResults(dedupeResults(results));
      showNotification(results.length === 0 ? 'No results found!' : `Found ${results.length} results!`);
    } catch (err) {
      showNotification('API search failed!', 'error');
    }
    setIsImporting(false);
  };

  const handleTrendingImport = async () => {
    setIsImporting(true);
    try {
      const results = await getAniListTrending();
      setImportResults(dedupeResults(results));
      showNotification(`Loaded ${results.length} trending!`);
    } catch (err) {
      showNotification('Failed!', 'error');
    }
    setIsImporting(false);
  };

  const handleTopImport = async () => {
    setIsImporting(true);
    try {
      const results = await getJikanTop('anime', 'bypopularity', 15);
      setImportResults(dedupeResults(results));
      showNotification(`Loaded ${results.length} top!`);
    } catch (err) {
      showNotification('Failed!', 'error');
    }
    setIsImporting(false);
  };

  const handleSeasonalImport = async () => {
    setIsImporting(true);
    try {
      const results = await getJikanSeasonal(null, null);
      setImportResults(dedupeResults(results));
      showNotification(`Loaded ${results.length} seasonal!`);
    } catch (err) {
      showNotification('Failed!', 'error');
    }
    setIsImporting(false);
  };

  const handleFetchNews = async () => {
    setIsImporting(true);
    try {
      const newsResults = await fetchAnimeNews();
      if (!Array.isArray(newsResults) || newsResults.length === 0) {
        showNotification('No news found from APIs', 'error');
        setIsImporting(false);
        return;
      }
      let added = 0;
      const existingTitles = new Set(newsItems.map((n: any) => n.title));
      for (const newsItem of newsResults) {
        if (existingTitles.has(newsItem.title)) continue;
        const result = await CloudflareAPI.postNews({
          title: newsItem.title,
          content: newsItem.content,
          image: newsItem.image,
          status: 'draft',
        });
        if (result.success && result.news) {
          added++;
          existingTitles.add(newsItem.title);
        }
      }
      await loadAllData();
      if (added > 0) {
        showNotification(`Imported ${added} new articles!`);
      } else {
        showNotification('No new articles to import (all already exist)');
      }
    } catch (err) {
      showNotification('Failed to fetch news!', 'error');
    }
    setIsImporting(false);
  };

  const importApiResult = async (apiItem: any) => {
    setIsImporting(true);
    const enrichedItem = await enrichWithFullSynopsis(apiItem);
    const animeData = apiResultToAnime(enrichedItem);
    try {
      const result = await CloudflareAPI.postAnime(animeData);
      if (result.success && result.anime) {
        setAnimeList(prev => [...prev, result.anime]);
      } else {
        await loadAllData();
      }
      setImportResults(prev => prev.filter((r: any) => r.id !== apiItem.id));
      showNotification(`${animeData.title} imported!`);
    } catch (err) {
      showNotification('Import failed!', 'error');
    }
    setIsImporting(false);
  };

  const importAllResults = async () => {
    setIsImporting(true);
    let count = 0;
    for (const item of importResults) {
      try {
        const enrichedItem = await enrichWithFullSynopsis(item);
        await CloudflareAPI.postAnime(apiResultToAnime(enrichedItem));
        count++;
      } catch (err) {}
    }
    await loadAllData();
    setImportResults([]);
    showNotification(`Imported ${count} anime!`);
    setIsImporting(false);
  };

  // ---------- VIDNEST IMPORT (MERGED) ----------
  const handleVidnestSearch = async () => {
    if (!vidnestQuery.trim()) return;
    setVidnestLoading(true);
    try {
      const res = await fetch(`/api/stream-servers/vidnest?search=${encodeURIComponent(vidnestQuery)}&type=${selectedVidnestType}`);
      const data = await res.json();
      if (data.results) {
        setVidnestResults(data.results);
        showNotification(data.results.length === 0 ? 'No Vidnest results' : `Found ${data.results.length} anime on Vidnest`);
      } else {
        showNotification('Search failed', 'error');
      }
    } catch (err) {
      showNotification('Vidnest search failed', 'error');
    }
    setVidnestLoading(false);
  };

  const importVidnestAnime = async (vnResult: any) => {
    setIsImporting(true);
    try {
      const animeData = {
        title: vnResult.title,
        type: vnResult.type || 'TV',
        status: vnResult.status || 'Ongoing',
        episodes: vnResult.episodes || 0,
        score: vnResult.score || 0,
        year: vnResult.year?.toString() || new Date().getFullYear().toString(),
        genre: vnResult.genre || '',
        studio: vnResult.studio || 'Unknown',
        image: vnResult.image || 'https://via.placeholder.com/200x300',
        description: vnResult.description || '',
      };

      let animeId: string | null = null;
      const existing = animeList.find((a: any) => 
        a.title.toLowerCase() === animeData.title.toLowerCase()
      );
      
      if (existing) {
        animeId = existing.id;
        showNotification(`Anime "${animeData.title}" already exists, adding episodes...`);
      } else {
        const result = await CloudflareAPI.postAnime(animeData);
        if (result.success && result.anime) {
          animeId = result.anime.id;
          setAnimeList(prev => [...prev, result.anime]);
          showNotification(`Anime "${animeData.title}" imported!`);
        } else {
          throw new Error('Failed to import anime');
        }
      }

      if (!animeId) throw new Error('No anime ID');

      // --- Fetch existing episodes for this anime ---
      const allEpisodesRes = await CloudflareAPI.getEpisodes();
      const existingEpisodes = allEpisodesRes.episodes?.filter((ep: any) => ep.anime_id === animeId) || [];
      const existingMap = new Map<number, any>(existingEpisodes.map((ep: any) => [ep.number, ep]));

      const language = 'sub';
      const embedType = selectedVidnestType || 'anime';
      
      const epRes = await fetch(`/api/stream-servers/vidnest/episodes?anilistId=${vnResult.anilistId}&totalEpisodes=${vnResult.episodes || 0}&type=${embedType}&language=${language}`);
      const epData = await epRes.json();
      const vidEpisodes = epData.episodes || [];

      if (!vidEpisodes.length) {
        showNotification('No episodes found for this anime.', 'error');
        setIsImporting(false);
        return;
      }

      let added = 0;
      const langKey = 'jap';
      const newServerName = 'Vidnest';

      for (const ep of vidEpisodes) {
        const epNumber = ep.number;
        const newUrl = ep.link;
        const existingEp = existingMap.get(epNumber);

        if (existingEp) {
          // ---- MERGE into existing episode ----
          const mergedLanguages = { ...(existingEp.languages || {}) };
          const mergedServers = { ...(existingEp.servers || {}) };

          if (!mergedLanguages[langKey] || mergedLanguages[langKey] !== newUrl) {
            mergedLanguages[langKey] = newUrl;
          }
          if (!mergedServers[langKey]) {
            mergedServers[langKey] = {};
          }
          mergedServers[langKey][newServerName] = newUrl;

          const updateResult = await CloudflareAPI.putEpisode({
            id: existingEp.id,
            anime_id: animeId,
            number: epNumber,
            title: existingEp.title || `Episode ${epNumber}`,
            languages: mergedLanguages,
            servers: mergedServers,
          });
          if (updateResult.success) {
            setEpisodes(prev => prev.map(e => e.id === existingEp.id ? { ...e, languages: mergedLanguages, servers: mergedServers } : e));
            added++;
          }
        } else {
          // ---- NEW episode ----
          const epDataObj = {
            anime_id: animeId,
            number: epNumber,
            title: `Episode ${epNumber}`,
            languages: { [langKey]: newUrl },
            servers: { [langKey]: { [newServerName]: newUrl } },
          };
          try {
            const result = await CloudflareAPI.postEpisode(epDataObj);
            if (result.success && result.episode) {
              setEpisodes(prev => [...prev, result.episode]);
              added++;
            }
          } catch (e) {
            console.warn('Failed to add episode', epNumber, e);
          }
        }
      }

      await loadAllData();
      showNotification(`Imported ${added} episodes from Vidnest for "${vnResult.title}"`);

    } catch (err) {
      showNotification('Vidnest import failed: ' + (err as Error).message, 'error');
    }
    setIsImporting(false);
  };

  // ---------- NXSHA IMPORT (MERGED) ----------
  const handleNxshaAction = async () => {
    const query = nxshaQuery.trim();
    if (!query) return;

    const isNumeric = /^\d+$/.test(query);
    if (isNumeric) {
      await importNxshaById(query);
    } else {
      await handleNxshaSearch();
    }
  };

  const handleNxshaSearch = async () => {
    if (!nxshaQuery.trim()) return;
    setNxshaLoading(true);
    try {
      const res = await fetch(`/api/stream-servers/nxsha?search=${encodeURIComponent(nxshaQuery)}`);
      const data = await res.json();
      if (data.results) {
        setNxshaResults(data.results);
        showNotification(data.results.length === 0 ? 'No results found on Nxsha' : `Found ${data.results.length} results`);
      } else {
        showNotification('Search failed', 'error');
      }
    } catch (err) {
      showNotification('Nxsha search failed', 'error');
    }
    setNxshaLoading(false);
  };

  const importNxshaAnime = async (result: any, language: string = 'hin') => {
    setIsImporting(true);
    try {
      const animeData = {
        title: result.title,
        type: result.type || 'TV',
        status: result.status || 'Ongoing',
        episodes: result.episodes || 0,
        score: result.score || 0,
        year: result.year?.toString() || new Date().getFullYear().toString(),
        genre: result.genre || '',
        studio: result.studio || 'Unknown',
        image: result.image || 'https://via.placeholder.com/200x300',
        description: result.description || '',
      };

      let animeId: string | null = null;
      const existing = animeList.find((a: any) => 
        a.title.toLowerCase() === animeData.title.toLowerCase()
      );
      
      if (existing) {
        animeId = existing.id;
        showNotification(`Anime "${animeData.title}" already exists, adding episodes...`);
      } else {
        const res = await CloudflareAPI.postAnime(animeData);
        if (res.success && res.anime) {
          animeId = res.anime.id;
          setAnimeList(prev => [...prev, res.anime]);
          showNotification(`Anime "${animeData.title}" imported!`);
        } else {
          throw new Error('Failed to import anime');
        }
      }

      if (!animeId) throw new Error('No anime ID');

      // --- Fetch existing episodes for this anime ---
      const allEpisodesRes = await CloudflareAPI.getEpisodes();
      const existingEpisodes = allEpisodesRes.episodes?.filter((ep: any) => ep.anime_id === animeId) || [];
      const existingMap = new Map<number, any>(existingEpisodes.map((ep: any) => [ep.number, ep]));

      const tmdbId = result.tmdbId;
      const type = result.type === 'Movie' ? 'movie' : 'tv';

      const epRes = await fetch(
        `/api/stream-servers/nxsha/episodes?anilistId=${tmdbId}&totalEpisodes=${result.episodes || 0}&season=${nxshaSeason}&type=${type}`
      );
      const epData = await epRes.json();
      const nxEpisodes = epData.episodes || [];

      if (!nxEpisodes.length) {
        showNotification(`No episodes found for TMDb ID: ${tmdbId}`, 'error');
        setIsImporting(false);
        return;
      }

      let added = 0;
      const langKey = language;
      const newServerName = 'Nxsha';

      for (const ep of nxEpisodes) {
        const epNumber = ep.number;
        const newUrl = ep.link;
        const existingEp = existingMap.get(epNumber);

        if (existingEp) {
          const mergedLanguages = { ...(existingEp.languages || {}) };
          const mergedServers = { ...(existingEp.servers || {}) };
          if (!mergedLanguages[langKey] || mergedLanguages[langKey] !== newUrl) {
            mergedLanguages[langKey] = newUrl;
          }
          if (!mergedServers[langKey]) {
            mergedServers[langKey] = {};
          }
          mergedServers[langKey][newServerName] = newUrl;

          const updateResult = await CloudflareAPI.putEpisode({
            id: existingEp.id,
            anime_id: animeId,
            number: epNumber,
            title: existingEp.title || `Episode ${epNumber}`,
            languages: mergedLanguages,
            servers: mergedServers,
          });
          if (updateResult.success) {
            setEpisodes(prev => prev.map(e => e.id === existingEp.id ? { ...e, languages: mergedLanguages, servers: mergedServers } : e));
            added++;
          }
        } else {
          const epDataObj = {
            anime_id: animeId,
            number: epNumber,
            title: type === 'tv' ? `Season ${nxshaSeason} Episode ${epNumber}` : 'Movie',
            languages: { [langKey]: newUrl },
            servers: { [langKey]: { [newServerName]: newUrl } },
          };
          try {
            const res = await CloudflareAPI.postEpisode(epDataObj);
            if (res.success && res.episode) {
              setEpisodes(prev => [...prev, res.episode]);
              added++;
            }
          } catch (e) {
            console.warn('Failed to add episode', epNumber, e);
          }
        }
      }

      await loadAllData();
      showNotification(`Imported ${added} episodes from Nxsha for "${result.title}"`);

    } catch (err) {
      showNotification('Nxsha import failed: ' + (err as Error).message, 'error');
    }
    setIsImporting(false);
  };

  const importNxshaById = async (tmdbId: string) => {
    if (!tmdbId) return;
    setIsImporting(true);
    try {
      const result = {
        id: `nx-${tmdbId}`,
        tmdbId: parseInt(tmdbId),
        title: `TMDb ID ${tmdbId}`,
        image: 'https://via.placeholder.com/200x300',
        description: 'Imported via TMDb ID',
        type: 'TV',
        episodes: 12,
        score: 0,
        genre: '',
        studio: 'Unknown',
        status: 'Ongoing',
        year: new Date().getFullYear(),
        source: 'nxsha'
      };
      await importNxshaAnime(result, nxshaLanguage);
    } catch (err) {
      showNotification('Failed to import by ID', 'error');
    }
    setIsImporting(false);
  };

  // ---------- ANIKOTO IMPORT (MERGED) ----------
  const handleAnikotoSearch = async () => {
    if (!anikotoQuery.trim()) return;
    setAnikotoLoading(true);
    try {
      const res = await fetch(`/api/stream-servers/anikoto?search=${encodeURIComponent(anikotoQuery)}`);
      const data = await res.json();
      if (data.results) {
        setAnikotoResults(data.results);
        showNotification(data.results.length === 0 ? 'No results found' : `Found ${data.results.length} results`);
      } else {
        showNotification('Search failed', 'error');
      }
    } catch (err) {
      showNotification('Anikoto search failed', 'error');
    }
    setAnikotoLoading(false);
  };

  const importAnikotoAnime = async (result: any) => {
    setIsImporting(true);
    try {
      const animeData = {
        title: result.title,
        type: result.type || 'TV',
        status: result.status || 'Ongoing',
        episodes: result.episodes || 0,
        score: result.score || 0,
        year: result.year?.toString() || new Date().getFullYear().toString(),
        genre: result.genre || '',
        studio: result.studio || 'Unknown',
        image: result.image || 'https://via.placeholder.com/200x300',
        description: result.description || '',
      };

      let animeId: string | null = null;
      const existing = animeList.find((a: any) => 
        a.title.toLowerCase() === animeData.title.toLowerCase()
      );
      
      if (existing) {
        animeId = existing.id;
        showNotification(`Anime "${animeData.title}" already exists, adding episodes...`);
      } else {
        const res = await CloudflareAPI.postAnime(animeData);
        if (res.success && res.anime) {
          animeId = res.anime.id;
          setAnimeList(prev => [...prev, res.anime]);
          showNotification(`Anime "${animeData.title}" imported!`);
        } else {
          throw new Error('Failed to import anime');
        }
      }

      if (!animeId) throw new Error('No anime ID');

      // --- Fetch existing episodes for this anime ---
      const allEpisodesRes = await CloudflareAPI.getEpisodes();
      const existingEpisodes = allEpisodesRes.episodes?.filter((ep: any) => ep.anime_id === animeId) || [];
      const existingMap = new Map<number, any>(existingEpisodes.map((ep: any) => [ep.number, ep]));

      const language = anikotoLanguage; // 'sub' or 'dub'
      
      let url = `/api/stream-servers/anikoto/episodes?anikotoId=${result.anikotoId || ''}&language=${language}`;
      if (result.mal_id) url += `&malId=${result.mal_id}`;
      if (result.episodes) url += `&totalEpisodes=${result.episodes}`;
      
      const epRes = await fetch(url);
      const epData = await epRes.json();
      const episodes = epData.episodes || [];

      if (!episodes.length) {
        showNotification('No episodes found for this anime.', 'error');
        setIsImporting(false);
        return;
      }

      let added = 0;
      const langKey = language === 'sub' ? 'jap' : 'eng';
      const newServerName = 'MegaPlay';

      for (const ep of episodes) {
        const epNumber = ep.number;
        const newUrl = ep.link;
        const existingEp = existingMap.get(epNumber);

        if (existingEp) {
          const mergedLanguages = { ...(existingEp.languages || {}) };
          const mergedServers = { ...(existingEp.servers || {}) };
          if (!mergedLanguages[langKey] || mergedLanguages[langKey] !== newUrl) {
            mergedLanguages[langKey] = newUrl;
          }
          if (!mergedServers[langKey]) {
            mergedServers[langKey] = {};
          }
          mergedServers[langKey][newServerName] = newUrl;

          const updateResult = await CloudflareAPI.putEpisode({
            id: existingEp.id,
            anime_id: animeId,
            number: epNumber,
            title: existingEp.title || `Episode ${epNumber}`,
            languages: mergedLanguages,
            servers: mergedServers,
          });
          if (updateResult.success) {
            setEpisodes(prev => prev.map(e => e.id === existingEp.id ? { ...e, languages: mergedLanguages, servers: mergedServers } : e));
            added++;
          }
        } else {
          const epDataObj = {
            anime_id: animeId,
            number: epNumber,
            title: ep.title || `Episode ${epNumber}`,
            languages: { [langKey]: newUrl },
            servers: { [langKey]: { [newServerName]: newUrl } },
          };
          try {
            const res = await CloudflareAPI.postEpisode(epDataObj);
            if (res.success && res.episode) {
              setEpisodes(prev => [...prev, res.episode]);
              added++;
            }
          } catch (e) {
            console.warn('Failed to add episode', epNumber, e);
          }
        }
      }

      await loadAllData();
      showNotification(`Imported ${added} episodes from Anikoto/MegaPlay for "${result.title}"`);

    } catch (err) {
      showNotification('Anikoto import failed: ' + (err as Error).message, 'error');
    }
    setIsImporting(false);
  };

  // ==================== EPISODES ====================
  const filteredAnimeForEp = episodeSearch.trim()
    ? animeList.filter(a => a.title.toLowerCase().includes(episodeSearch.toLowerCase()))
    : animeList.slice(0, 20);

  const addEpisode = async () => {
    if (!selectedAnimeForEp) {
      showNotification('Please select an anime.', 'error');
      return;
    }
    const link = episodeForm.link.trim();
    if (!link) {
      showNotification('Please enter a video link.', 'error');
      return;
    }
    const langKey = episodeForm.language || 'jap';
    const serverName = episodeForm.serverName || 'Server 1';
    const servers = { [langKey]: { [serverName]: link } };
    const languages = { [langKey]: link };
    const epData = {
      anime_id: selectedAnimeForEp.id,
      number: episodeForm.number,
      title: episodeForm.title,
      languages,
      servers,
    };
    try {
      let result;
      if (editingEpisodeId) {
        const existingEp = episodes.find((ep: any) => ep.id === editingEpisodeId);
        if (existingEp) {
          const mergedLanguages = { ...(existingEp.languages || {}) };
          const mergedServers = { ...(existingEp.servers || {}) };
          if (mergedServers[langKey]) {
            mergedServers[langKey][serverName] = link;
          } else {
            mergedServers[langKey] = { [serverName]: link };
          }
          mergedLanguages[langKey] = link;
          epData.languages = mergedLanguages;
          epData.servers = mergedServers;
        }
        result = await CloudflareAPI.putEpisode({ id: editingEpisodeId, ...epData });
      } else {
        result = await CloudflareAPI.postEpisode(epData);
      }
      if (result.success && result.episode) {
        if (editingEpisodeId) {
          setEpisodes(prev => prev.map((ep: any) => (ep.id === editingEpisodeId ? { ...ep, ...result.episode } : ep)));
          setEditingEpisodeId(null);
          showNotification('Episode updated!');
        } else {
          setEpisodes(prev => [...prev, result.episode]);
          showNotification(`Episode ${epData.number} added!`);
        }
        setEpisodeForm({ number: episodeForm.number + 1, title: '', language: 'jap', serverName: 'Server 1', link: '' });
      } else {
        showNotification(`Failed to save episode: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (err: any) {
      showNotification('Network error while saving episode.', 'error');
    }
  };

  const editEpisode = (ep: any) => {
    setEditingEpisodeId(ep.id);
    const langKeys = Object.keys(ep.servers || {});
    const firstLang = langKeys.length > 0 ? langKeys[0] : 'jap';
    const serversForLang = ep.servers?.[firstLang] || {};
    const firstServer = Object.keys(serversForLang).length > 0 ? Object.keys(serversForLang)[0] : 'Server 1';
    const link = serversForLang[firstServer] || ep.languages?.[firstLang] || '';
    setEpisodeForm({
      number: ep.number,
      title: ep.title || '',
      language: firstLang,
      serverName: firstServer,
      link
    });
    const anime = animeList.find((a: any) => a.id == ep.anime_id);
    if (anime) setSelectedAnimeForEp(anime);
    setActiveSection('episodes');
  };

  const deleteEpisode = async (id: any) => {
    try {
      await CloudflareAPI.deleteEpisode(id);
      setEpisodes(prev => prev.filter((ep: any) => ep.id !== id));
      if (editingEpisodeId === id) {
        setEditingEpisodeId(null);
        setEpisodeForm({ number: 1, title: '', language: 'jap', serverName: 'Server 1', link: '' });
      }
      showNotification('Episode deleted!');
    } catch (err) {
      showNotification('Failed!', 'error');
    }
  };

  const addServerToEpisode = async () => {
    const { episodeId, language, serverName, link } = addServerForm;
    if (!episodeId || !language || !serverName || !link) {
      showNotification('Please fill all fields.', 'error');
      return;
    }
    const ep = episodes.find(e => e.id === episodeId);
    if (!ep) {
      showNotification('Episode not found.', 'error');
      return;
    }
    const updatedServers = { ...(ep.servers || {}) };
    if (!updatedServers[language]) updatedServers[language] = {};
    updatedServers[language][serverName] = link;
    const updatedLanguages = { ...(ep.languages || {}) };
    if (!updatedLanguages[language]) updatedLanguages[language] = link;
    try {
      const result = await CloudflareAPI.putEpisode({
        id: episodeId,
        anime_id: ep.anime_id,
        number: ep.number,
        title: ep.title,
        languages: updatedLanguages,
        servers: updatedServers,
      });
      if (result.success) {
        setEpisodes(prev => prev.map(e => e.id === episodeId ? { ...e, languages: updatedLanguages, servers: updatedServers } : e));
        showNotification(`Server "${serverName}" added to episode ${ep.number}!`);
        setAddServerForm({ episodeId: null, language: 'jap', serverName: '', link: '' });
      } else {
        showNotification('Failed to add server.', 'error');
      }
    } catch (err) {
      showNotification('Network error.', 'error');
    }
  };

  const editServerLink = async (episodeId: string, language: string, serverName: string, newLink: string) => {
    if (!newLink.trim()) {
      showNotification('Link cannot be empty.', 'error');
      return;
    }
    try {
      const ep = episodes.find(e => e.id === episodeId);
      if (!ep) {
        showNotification('Episode not found.', 'error');
        return;
      }
      const updatedServers = { ...(ep.servers || {}) };
      if (!updatedServers[language]) updatedServers[language] = {};
      updatedServers[language][serverName] = newLink;
      const updatedLanguages = { ...(ep.languages || {}) };
      updatedLanguages[language] = newLink;

      await CloudflareAPI.putEpisode({
        id: episodeId,
        anime_id: ep.anime_id,
        number: ep.number,
        title: ep.title,
        languages: updatedLanguages,
        servers: updatedServers,
      });
      setEpisodes(prev => prev.map(e => e.id === episodeId ? { ...e, languages: updatedLanguages, servers: updatedServers } : e));
      showNotification(`Server "${serverName}" updated!`);
      const updatedEp = episodes.find(e => e.id === episodeId);
      if (updatedEp && serverManagementModal) {
        setServerManagementModal({ episode: updatedEp, animeTitle: serverManagementModal.animeTitle });
      }
    } catch (err) {
      showNotification('Failed to update server.', 'error');
    }
  };

  // ==================== SCHEDULE ====================
  const addSchedule = async () => {
    if (!scheduleForm.title && !scheduleForm.anime_id) {
      showNotification('Select anime or enter title!', 'error');
      return;
    }
    try {
      if (editingSchedule) {
        await CloudflareAPI.putSchedule({ id: editingSchedule.id, ...scheduleForm });
        setScheduleItems(prev => prev.map((s: any) => s.id === editingSchedule.id ? { ...s, ...scheduleForm } : s));
        setEditingSchedule(null);
        showNotification('Updated!');
        fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '📅 Schedule Updated!',
            body: `${scheduleForm.title || 'Anime'} – Episode ${scheduleForm.episode} on ${DAYS[scheduleForm.day]} at ${scheduleForm.time}`,
            icon: '/favicon.ico',
          }),
        }).catch(() => {});
      } else {
        const result = await CloudflareAPI.postSchedule(scheduleForm);
        if (result.success && result.item) {
          setScheduleItems(prev => [...prev, result.item]);
          fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: '📅 New Anime Airing!',
              body: `${scheduleForm.title || 'Anime'} – Episode ${scheduleForm.episode} on ${DAYS[scheduleForm.day]} at ${scheduleForm.time}`,
              icon: '/favicon.ico',
            }),
          }).catch(() => {});
        } else {
          await loadAllData();
        }
        showNotification('Added!');
      }
      setScheduleForm({ day: 1, time: '18:00', title: '', episode: 1, link: '', anime_id: null });
    } catch (err) {
      showNotification('Failed!', 'error');
    }
  };

  const editScheduleItem = (item: any) => {
    setEditingSchedule(item);
    setScheduleForm({ day: item.day, time: item.time, title: item.title, episode: item.episode, link: item.link, anime_id: item.anime_id });
    setActiveSection('schedule');
  };

  const deleteScheduleItem = async (id: any) => {
    await CloudflareAPI.deleteSchedule(id);
    setScheduleItems(prev => prev.filter((s: any) => s.id !== id));
    showNotification('Deleted!');
  };

  const handleAutoSchedule = async () => {
    setIsImporting(true);
    try {
      const trending = await getAniListTrending();
      if (!trending.length) {
        showNotification('No data!', 'error');
        setIsImporting(false);
        return;
      }
      const timeSlots = ['09:00', '12:00', '15:00', '18:00', '20:00', '22:00', '23:30'];
      for (let i = 0; i < Math.min(trending.length, 7); i++) {
        await CloudflareAPI.postSchedule({
          day: i % 7,
          time: timeSlots[i % timeSlots.length],
          title: trending[i].title,
          episode: 1,
          link: '',
          anime_id: null,
        });
      }
      await loadAllData();
      showNotification(`Added ${Math.min(trending.length, 7)} shows!`);
    } catch (err) {
      showNotification('Failed!', 'error');
    }
    setIsImporting(false);
  };

  const clearAllSchedule = async () => {
    if (!confirm('Delete all schedule items?')) return;
    try {
      for (const item of scheduleItems) await CloudflareAPI.deleteSchedule(item.id);
      setScheduleItems([]);
      showNotification('Cleared!');
    } catch (err) {
      showNotification('Failed!', 'error');
    }
  };

  // ==================== SLIDERS ====================
  const toggleFeatured = async (id: string) => {
    let newFeatured: string[];
    if (featuredIds.includes(id)) {
      if (featuredIds.length <= 1) {
        showNotification('Need at least 1!', 'error');
        return;
      }
      newFeatured = featuredIds.filter(fid => fid !== id);
    } else {
      if (featuredIds.length >= 5) {
        showNotification('Max 5!', 'error');
        return;
      }
      newFeatured = [...featuredIds, id];
    }
    setFeaturedIds(newFeatured);
    await CloudflareAPI.putFeatured(newFeatured);
  };

  const moveFeatured = async (id: string, dir: string) => {
    const idx = featuredIds.indexOf(id);
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === featuredIds.length - 1)) return;
    const newOrder = [...featuredIds];
    [newOrder[idx], newOrder[dir === 'up' ? idx - 1 : idx + 1]] = [newOrder[dir === 'up' ? idx - 1 : idx + 1], newOrder[idx]];
    setFeaturedIds(newOrder);
    await CloudflareAPI.putFeatured(newOrder);
  };

  const toggleNewlyAdded = async (id: string) => {
    let updated: string[];
    if (newlyAddedIds.includes(id)) {
      updated = newlyAddedIds.filter(fid => fid !== id);
    } else {
      updated = [...newlyAddedIds, id];
    }
    setNewlyAddedIds(updated);
    await CloudflareAPI.putNewlyAdded(updated);
  };

  const moveNewlyAdded = async (id: string, dir: string) => {
    const idx = newlyAddedIds.indexOf(id);
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === newlyAddedIds.length - 1)) return;
    const newOrder = [...newlyAddedIds];
    [newOrder[idx], newOrder[dir === 'up' ? idx - 1 : idx + 1]] = [newOrder[dir === 'up' ? idx - 1 : idx + 1], newOrder[idx]];
    setNewlyAddedIds(newOrder);
    await CloudflareAPI.putNewlyAdded(newOrder);
  };

  const currentIds = slidersTab === 'featured' ? featuredIds : newlyAddedIds;
  const toggleCurrent = slidersTab === 'featured' ? toggleFeatured : toggleNewlyAdded;
  const moveCurrent = slidersTab === 'featured' ? moveFeatured : moveNewlyAdded;

  // ==================== NEWS ====================
  const saveNews = async () => {
    if (!newsForm.title) return;
    try {
      if (editingNews) {
        await CloudflareAPI.putNews({ id: editingNews.id, ...newsForm });
        setNewsItems(prev => prev.map((n: any) => n.id === editingNews.id ? { ...n, ...newsForm } : n));
        setEditingNews(null);
        showNotification('Updated!');
        fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: '📰 News Updated!', body: newsForm.title, icon: newsForm.image }),
        }).catch(() => {});
      } else {
        const exists = newsItems.some((n: any) => n.title === newsForm.title && n.content === newsForm.content);
        if (exists) {
          showNotification('Duplicate article!', 'error');
          return;
        }
        const result = await CloudflareAPI.postNews(newsForm);
        if (result.success && result.news) {
          setNewsItems(prev => [...prev, result.news]);
          fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: '📰 New Anime News!', body: newsForm.title, icon: newsForm.image }),
          }).catch(() => {});
        }
        showNotification('Published!');
      }
      setNewsForm({ title: '', content: '', image: '', status: 'draft' });
    } catch (err) {
      showNotification('Failed!', 'error');
    }
  };

  const editNewsItem = (item: any) => {
    setEditingNews(item);
    setNewsForm({ title: item.title, content: item.content, image: item.image, status: item.status });
    setActiveSection('news');
  };

  const deleteNewsItem = async (id: any) => {
    await CloudflareAPI.deleteNews(id);
    setNewsItems(prev => prev.filter((n: any) => n.id !== id));
    showNotification('Deleted!');
  };

  // ==================== DELETE ANIME ====================
  const deleteAnime = async (id: any) => {
    try {
      await CloudflareAPI.deleteAnime(id);
      setAnimeList(prev => prev.filter((a: any) => a.id !== id));
      setEpisodes(prev => prev.filter((ep: any) => ep.anime_id != id));
      if (featuredIds.includes(id)) {
        const nf = featuredIds.filter(fid => fid !== id);
        setFeaturedIds(nf);
        await CloudflareAPI.putFeatured(nf);
      }
      if (newlyAddedIds.includes(id)) {
        const nf = newlyAddedIds.filter(fid => fid !== id);
        setNewlyAddedIds(nf);
        await CloudflareAPI.putNewlyAdded(nf);
      }
      showNotification('Deleted!');
    } catch (err) {
      showNotification('Failed!', 'error');
    }
  };

  // ==================== QUICK FIX LINK FROM REPORT ====================
  const fixReportedLink = async (animeId: string, epNumber: number, newUrl: string) => {
    const ep = episodes.find((e: any) => e.anime_id == animeId && e.number == epNumber);
    if (!ep) {
      showNotification('Episode not found!', 'error');
      return;
    }
    const lang = Object.keys(ep.servers || {})[0] || 'jap';
    const updatedServers = { ...(ep.servers || {}) };
    if (!updatedServers[lang]) updatedServers[lang] = {};
    const firstServer = Object.keys(updatedServers[lang]).length > 0 ? Object.keys(updatedServers[lang])[0] : 'Server 1';
    updatedServers[lang][firstServer] = newUrl;
    const updatedLanguages = { ...(ep.languages || {}), [lang]: newUrl };
    try {
      await CloudflareAPI.putEpisode({
        id: ep.id,
        anime_id: ep.anime_id,
        number: ep.number,
        title: ep.title,
        languages: updatedLanguages,
        servers: updatedServers,
      });
      await loadAllData();
      showNotification('Link updated!');
      setQuickEditEp(null);
    } catch (err) {
      showNotification('Failed to update link', 'error');
    }
  };

  // ==================== FILTERED CONTENT FOR DISPLAY ====================
  const allEpisodeDisplayNames = Array.from(
    new Set(
      episodes.flatMap(ep =>
        Object.entries(ep.languages || {})
          .filter(([lang, url]) => url && typeof url === 'string' && url.trim() !== '')
          .map(([lang]) => getLanguageDisplay(lang))
      )
    )
  )
    .filter(name => !['dub', 'sub', 'DUB', 'SUB'].includes(name) && name)
    .sort();

  const filteredAnime = animeList
    .map((a: any) => ({
      ...a,
      reportCount: getReportCountForAnime(a.id, reports)
    }))
    .filter((a: any) => {
      if (contentSearch && !a.title.toLowerCase().includes(contentSearch.toLowerCase())) return false;
      if (contentGenre !== 'All' && a.genre) {
        const genres = a.genre.split(',').map((g: string) => g.trim());
        if (!genres.includes(contentGenre)) return false;
      }
      if (contentType !== 'All' && a.type !== contentType) return false;
      if (contentLang) {
        const hasEpInLang = episodes.some((ep: any) => {
          if (ep.anime_id != a.id) return false;
          return Object.entries(ep.languages || {})
            .some(([lang, url]) => getLanguageDisplay(lang) === contentLang && url && typeof url === 'string' && url.trim() !== '');
        });
        if (!hasEpInLang) return false;
      }
      return true;
    })
    .sort((a: any, b: any) => b.reportCount - a.reportCount);

  const types = ['All', ...new Set(animeList.map((a: any) => a.type).filter(Boolean))] as string[];

  // ==================== RENDER ====================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#0a0a0f' }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '25px 25px' }} />
        <div className="absolute top-20 left-20 w-72 h-72 rounded-full blur-3xl opacity-10" style={{ background: '#ec4899' }} />
        <div className="absolute bottom-20 right-20 w-72 h-72 rounded-full blur-3xl opacity-10" style={{ background: '#8b5cf6' }} />
        <div className="relative z-10 w-full max-w-sm">
          <div className="text-center mb-8"><div className="inline-flex p-4 rounded-3xl mb-5 shadow-2xl" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}><Shield className="w-10 h-10 text-white" /></div><h1 className="text-2xl font-black text-white">AnimeTown CMS</h1><p className="text-white/25 text-sm mt-2">Admin Access Only</p></div>
          <div className="rounded-3xl p-8 border border-white/5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)' }}>
            {loginError && <div className="flex items-center gap-3 bg-red-500/10 text-red-400 p-4 rounded-2xl text-sm mb-5"><AlertCircle className="w-5 h-5" /> {loginError}</div>}
            <form onSubmit={handleLogin} className="space-y-4">
              <div><label className="block text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white placeholder-white/20 focus:border-pink-500 outline-none text-center text-lg tracking-widest" autoFocus /></div>
              <button type="submit" disabled={loginLoading} className="w-full py-4 rounded-2xl text-white font-bold text-sm tracking-wider transition-all hover:scale-[1.02] active:scale-95 shadow-xl disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}>
                {loginLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'UNLOCK'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#060608' }}><div className="text-center"><RefreshCw className="w-10 h-10 animate-spin text-purple-400 mx-auto mb-4" /><p className="text-white/50 text-sm">Loading...</p></div></div>;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#060608' }}>
      {notification && <div className="fixed top-4 right-4 z-[200] px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-2" style={{ background: notification.type === 'success' ? '#10b981' : '#ef4444', color: 'white' }}><Check className="w-4 h-4" /> {notification.msg}</div>}

      <header className="sticky top-0 z-50 border-b border-white/5 px-4 md:px-6 py-3 flex items-center justify-between" style={{ background: 'rgba(6,6,8,0.95)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}><Zap className="w-5 h-5 text-white" /></div><h1 className="text-sm font-black text-white">CMS</h1></div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activeSection === item.id ? 'text-white' : 'text-white/35 hover:text-white/70'}`}
                style={activeSection === item.id ? { background: `${item.color}20` } : {}}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: activeSection === item.id ? item.color : undefined }} />
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 flex">
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 px-2 py-2 flex gap-1 overflow-x-auto" style={{ background: 'rgba(6,6,8,0.98)' }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-[9px] font-bold transition-all shrink-0 ${isActive ? 'text-white' : 'text-white/30'}`}
                style={isActive ? { background: `${item.color}20` } : {}}
              >
                <Icon className="w-4 h-4" style={{ color: isActive ? item.color : undefined }} />
                {item.label}
              </button>
            );
          })}
        </div>

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-y-auto max-w-6xl mx-auto w-full">

          {/* ==================== IMPORT ==================== */}
          {activeSection === 'import' && (
            <div className="space-y-6">
              <div><h2 className="text-xl font-black text-white">Import</h2></div>
              <div className="flex gap-2 mb-4 flex-wrap">
                <button onClick={() => setImportTab('api')} className={`px-4 py-2 rounded-xl text-xs font-bold ${importTab === 'api' ? 'bg-pink-600 text-white' : 'bg-white/5 text-white/40'}`}>API</button>
                <button onClick={() => setImportTab('vidnest')} className={`px-4 py-2 rounded-xl text-xs font-bold ${importTab === 'vidnest' ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/40'}`}>Vidnest</button>
                <button onClick={() => setImportTab('nxsha')} className={`px-4 py-2 rounded-xl text-xs font-bold ${importTab === 'nxsha' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/40'}`}>Nxsha</button>
                <button onClick={() => setImportTab('anikoto')} className={`px-4 py-2 rounded-xl text-xs font-bold ${importTab === 'anikoto' ? 'bg-green-600 text-white' : 'bg-white/5 text-white/40'}`}>Anikoto</button>
              </div>

              {importTab === 'api' && (
                <div className="rounded-2xl border border-white/5 p-4 md:p-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex gap-3 mb-4"><input type="text" value={importQuery} onChange={(e) => setImportQuery(e.target.value)} placeholder="Search anime..." className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:border-pink-500 outline-none" onKeyDown={(e) => e.key === 'Enter' && handleApiSearch()} /><button onClick={handleApiSearch} disabled={isImporting} className="px-5 py-3 rounded-xl text-white font-bold text-xs flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #ec4899, #db2777)' }}>{isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}Search APIs</button></div>
                  <div className="flex gap-2 flex-wrap mb-4">
                    <button onClick={handleTrendingImport} disabled={isImporting} className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600/20 text-purple-400 border border-purple-600/30 hover:bg-purple-600/30 disabled:opacity-50">🔥 Trending</button>
                    <button onClick={handleTopImport} disabled={isImporting} className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600/20 text-cyan-400 border border-cyan-600/30 hover:bg-cyan-600/30 disabled:opacity-50">📊 Top Rated</button>
                    <button onClick={handleSeasonalImport} disabled={isImporting} className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30 disabled:opacity-50">🌸 Seasonal</button>
                    <button onClick={handleFetchNews} disabled={isImporting} className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600/20 text-amber-400 border border-amber-600/30 hover:bg-amber-600/30 disabled:opacity-50">📰 Fetch News</button>
                  </div>
                  {importResults.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <div className="flex justify-between items-center"><h4 className="text-sm font-bold text-white">Results ({importResults.length})</h4><button onClick={importAllResults} disabled={isImporting} className="px-4 py-2 rounded-xl text-xs font-bold bg-pink-600 text-white">Import All</button></div>
                      {importResults.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-pink-500/20" style={{ background: 'rgba(255,255,255,0.01)' }}>
                          <div className="w-14 h-20 rounded-lg bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${item.image})` }} />
                          <div className="flex-1 min-w-0"><p className="text-sm font-bold text-white">{item.title}</p><p className="text-xs text-white/30">{item.type} • {item.studio || '?'} • {item.year} • {item.episodes} eps</p><div className="flex items-center gap-3 mt-1"><span className="text-[10px] text-amber-400 font-bold">★ {item.score}</span><span className="text-[9px] px-1.5 py-0.5 rounded text-white/50 bg-white/5">{item.source?.toUpperCase()}</span></div><p className="text-[10px] text-white/20 mt-1">{item.genre}</p></div>
                          <button onClick={() => importApiResult(item)} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-pink-600/80 hover:bg-pink-600 shrink-0">Import</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {importTab === 'vidnest' && (
                <div className="rounded-2xl border border-white/5 p-4 md:p-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex gap-3 mb-4">
                    <input
                      type="text"
                      value={vidnestQuery}
                      onChange={(e) => setVidnestQuery(e.target.value)}
                      placeholder="Search anime on Vidnest..."
                      className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:border-purple-500 outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleVidnestSearch()}
                    />
                    <button
                      onClick={handleVidnestSearch}
                      disabled={vidnestLoading}
                      className="px-5 py-3 rounded-xl text-white font-bold text-xs flex items-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
                    >
                      {vidnestLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Search Vidnest
                    </button>
                  </div>

                  <div className="flex gap-3 mb-4">
                    <label className="text-xs text-white/40 flex items-center">Embed Type:</label>
                    <button
                      onClick={() => setSelectedVidnestType('anime')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                        selectedVidnestType === 'anime' 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-white/5 text-white/40'
                      }`}
                    >
                      Vidnest Anime
                    </button>
                    <button
                      onClick={() => setSelectedVidnestType('animepahe')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                        selectedVidnestType === 'animepahe' 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-white/5 text-white/40'
                      }`}
                    >
                      AnimePahe
                    </button>
                  </div>

                  {vidnestResults.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h4 className="text-sm font-bold text-white">Vidnest Results ({vidnestResults.length})</h4>
                      {vidnestResults.map((result) => (
                        <div key={result.id} className="flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-purple-500/20" style={{ background: 'rgba(255,255,255,0.01)' }}>
                          <div className="w-14 h-20 rounded-lg bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${result.image})` }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white">{result.title}</p>
                            <p className="text-xs text-white/30">
                              {result.type} • {result.episodes} eps • ★{result.score}
                            </p>
                            <p className="text-xs text-white/20 line-clamp-1">{result.genre}</p>
                            <p className="text-[10px] text-white/20 mt-1">AniList ID: {result.anilistId}</p>
                          </div>
                          <button
                            onClick={() => importVidnestAnime(result)}
                            disabled={isImporting}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600/80 hover:bg-purple-600 shrink-0 disabled:opacity-50"
                          >
                            Import Anime + Episodes
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {vidnestResults.length === 0 && vidnestQuery && !vidnestLoading && (
                    <p className="text-white/30 text-sm text-center mt-4">No results found on Vidnest.</p>
                  )}
                </div>
              )}

              {importTab === 'nxsha' && (
                <div className="rounded-2xl border border-white/5 p-4 md:p-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex gap-3 mb-4">
                    <input
                      type="text"
                      value={nxshaQuery}
                      onChange={(e) => setNxshaQuery(e.target.value)}
                      placeholder="Search by title or paste TMDb ID (e.g., 1399)..."
                      className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:border-blue-500 outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleNxshaAction()}
                    />
                    <button
                      onClick={handleNxshaAction}
                      disabled={isImporting || !nxshaQuery.trim()}
                      className="px-5 py-3 rounded-xl text-white font-bold text-xs flex items-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                    >
                      {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Go
                    </button>
                  </div>

                  <div className="flex gap-3 mb-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-white/40">Season:</label>
                      <input
                        type="number"
                        value={nxshaSeason}
                        onChange={(e) => setNxshaSeason(parseInt(e.target.value) || 1)}
                        min="1"
                        className="bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white w-20"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-white/40">Language:</label>
                      <select
                        value={nxshaLanguage}
                        onChange={(e) => setNxshaLanguage(e.target.value)}
                        className="bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white"
                      >
                        {Object.entries(LANGUAGE_DISPLAY_NAMES).map(([code, name]) => (
                          <option key={code} value={code}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {nxshaResults.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h4 className="text-sm font-bold text-white">Results ({nxshaResults.length})</h4>
                      {nxshaResults.map((result) => (
                        <div key={result.id} className="flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-blue-500/20" style={{ background: 'rgba(255,255,255,0.01)' }}>
                          <div className="w-14 h-20 rounded-lg bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${result.image})` }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white">{result.title}</p>
                            <p className="text-xs text-white/30">
                              {result.type} • {result.episodes} eps
                            </p>
                            <p className="text-[10px] text-white/20 mt-1">TMDb ID: {result.tmdbId}</p>
                          </div>
                          <button
                            onClick={() => importNxshaAnime(result, nxshaLanguage)}
                            disabled={isImporting}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600/80 hover:bg-blue-600 shrink-0 disabled:opacity-50"
                          >
                            Import
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {nxshaResults.length === 0 && nxshaQuery && !isImporting && (
                    <p className="text-white/30 text-sm text-center mt-4">No results found. Try a different title or paste a TMDb ID.</p>
                  )}
                </div>
              )}

              {importTab === 'anikoto' && (
                <div className="rounded-2xl border border-white/5 p-4 md:p-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex gap-3 mb-4">
                    <input
                      type="text"
                      value={anikotoQuery}
                      onChange={(e) => setAnikotoQuery(e.target.value)}
                      placeholder="Search anime on Anikoto..."
                      className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:border-green-500 outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleAnikotoSearch()}
                    />
                    <button
                      onClick={handleAnikotoSearch}
                      disabled={anikotoLoading}
                      className="px-5 py-3 rounded-xl text-white font-bold text-xs flex items-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                    >
                      {anikotoLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Search Anikoto
                    </button>
                  </div>

                  <div className="flex gap-3 mb-4">
                    <label className="text-xs text-white/40 flex items-center">Language:</label>
                    <button
                      onClick={() => setAnikotoLanguage('sub')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                        anikotoLanguage === 'sub' 
                          ? 'bg-green-600 text-white' 
                          : 'bg-white/5 text-white/40'
                      }`}
                    >
                      Sub
                    </button>
                    <button
                      onClick={() => setAnikotoLanguage('dub')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                        anikotoLanguage === 'dub' 
                          ? 'bg-green-600 text-white' 
                          : 'bg-white/5 text-white/40'
                      }`}
                    >
                      Dub
                    </button>
                  </div>

                  {anikotoResults.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h4 className="text-sm font-bold text-white">Results ({anikotoResults.length})</h4>
                      {anikotoResults.map((result) => (
                        <div key={result.id} className="flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-green-500/20" style={{ background: 'rgba(255,255,255,0.01)' }}>
                          <div className="w-14 h-20 rounded-lg bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${result.image})` }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white">{result.title}</p>
                            <p className="text-xs text-white/30">
                              {result.type} • {result.episodes} eps • ★{result.score}
                            </p>
                            <p className="text-xs text-white/20 line-clamp-1">{result.genre}</p>
                            {result.note && (
                              <p className="text-[10px] text-amber-400/70 mt-1">{result.note}</p>
                            )}
                            <p className="text-[10px] text-white/20 mt-1">MAL ID: {result.mal_id}</p>
                          </div>
                          <button
                            onClick={() => importAnikotoAnime(result)}
                            disabled={isImporting}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-green-600/80 hover:bg-green-600 shrink-0 disabled:opacity-50"
                          >
                            Import Anime + Episodes
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {anikotoResults.length === 0 && anikotoQuery && !anikotoLoading && (
                    <p className="text-white/30 text-sm text-center mt-4">No results found on Anikoto.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ==================== EPISODES ==================== */}
          {activeSection === 'episodes' && (
            <div className="space-y-6">
              <div><h2 className="text-xl font-black text-white">Episode Manager</h2></div>
              <div className="rounded-2xl border border-white/5 p-4 md:p-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <input
                  type="text"
                  placeholder="Search anime..."
                  value={episodeSearch}
                  onChange={(e) => setEpisodeSearch(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:border-purple-500 outline-none mb-4"
                />
                {!selectedAnimeForEp && (
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {filteredAnimeForEp.map((a: any) => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAnimeForEp(a)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-white hover:bg-white/5 flex items-center gap-3"
                      >
                        <div className="w-8 h-10 rounded bg-cover shrink-0" style={{ backgroundImage: `url(${a.image})` }} />
                        {a.title}
                      </button>
                    ))}
                  </div>
                )}
                {selectedAnimeForEp && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
                      <Film className="w-6 h-6 text-purple-400" />
                      <div>
                        <p className="text-sm font-bold text-white">{selectedAnimeForEp.title}</p>
                        <button onClick={() => setSelectedAnimeForEp(null)} className="text-xs text-purple-300">Change</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div><label className="text-[10px] text-white/30">Episode #</label><input type="number" value={episodeForm.number} onChange={(e) => setEpisodeForm({...episodeForm, number: parseInt(e.target.value) || 1})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
                      <div className="md:col-span-2"><label className="text-[10px] text-white/30">Title</label><input type="text" value={episodeForm.title} onChange={(e) => setEpisodeForm({...episodeForm, title: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
                      <div><label className="text-[10px] text-white/30">Language Code</label>
                        <select value={episodeForm.language} onChange={(e) => setEpisodeForm({...episodeForm, language: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1">
                          {Object.keys(LANGUAGE_DISPLAY_NAMES).map(lang => (
                            <option key={lang} value={lang}>{lang} ({LANGUAGE_DISPLAY_NAMES[lang]})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div><label className="text-[10px] text-white/30">Server Name</label><input type="text" value={episodeForm.serverName} onChange={(e) => setEpisodeForm({...episodeForm, serverName: e.target.value})} placeholder="e.g. Vidnest, Nxsha" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
                      <div className="md:col-span-2"><label className="text-[10px] text-white/30">Link</label><input type="text" value={episodeForm.link} onChange={(e) => setEpisodeForm({...episodeForm, link: e.target.value})} placeholder="Video URL..." className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 mt-1" /></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addEpisode} className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>{editingEpisodeId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{editingEpisodeId ? 'Update' : 'Add Episode'}</button>
                      {editingEpisodeId && <button onClick={() => { setEditingEpisodeId(null); setEpisodeForm({ number: 1, title: '', language: 'jap', serverName: 'Server 1', link: '' }); }} className="px-6 py-3 rounded-xl text-white/50 text-sm bg-white/5">Cancel</button>}
                    </div>
                  </div>
                )}
              </div>
              {selectedAnimeForEp && (
                <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.01)' }}>
                  <div className="p-4 border-b border-white/5 flex justify-between items-center"><h3 className="text-sm font-bold text-white">Episodes ({episodes.filter((ep: any) => ep.anime_id == selectedAnimeForEp?.id).length})</h3></div>
                  {episodes.filter((ep: any) => ep.anime_id == selectedAnimeForEp?.id).sort((a: any, b: any) => a.number - b.number).map((ep: any) => (
                    <div key={ep.id} className="p-4 border-b border-white/5 hover:bg-white/[0.01]">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-8 rounded-lg flex items-center justify-center text-sm font-black text-white bg-purple-500/30">#{ep.number}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white">{ep.title || `Episode ${ep.number}`}</p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {Object.keys(ep.servers || {}).map(lang => (
                              <span key={lang} className="text-[9px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded flex items-center gap-1">
                                {getLanguageDisplay(lang)}
                                <span className="text-[8px] text-white/20">({Object.keys(ep.servers[lang] || {}).length} servers)</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => editEpisode(ep)} className="p-2 text-white/30 hover:text-blue-400"><Edit className="w-4 h-4"/></button>
                          <button onClick={() => deleteEpisode(ep.id)} className="p-2 text-white/30 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                          <button onClick={() => setServerManagementModal({ episode: ep, animeTitle: selectedAnimeForEp?.title || '' })} className="p-2 text-white/30 hover:text-green-400">
                            <ServerIcon className="w-4 h-4"/>
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 ml-16 space-y-1">
                        {Object.entries(ep.servers || {}).map(([lang, serversObj]) => {
                          const serversRecord = serversObj as Record<string, string>;
                          return (
                            <div key={lang} className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white/50">{getLanguageDisplay(lang)}:</span>
                              {Object.entries(serversRecord).map(([srv, url]) => (
                                <span key={srv} className="bg-white/5 px-2 py-0.5 rounded flex items-center gap-1">
                                  {srv} <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">link</a>
                                </span>
                              ))}
                            </div>
                          );
                        })}
                        <button
                          onClick={() => setAddServerForm({ episodeId: ep.id, language: 'jap', serverName: 'Server 2', link: '' })}
                          className="text-[10px] text-blue-400 hover:underline"
                        >
                          + Add Server
                        </button>
                      </div>
                    </div>
                  ))}
                  {addServerForm.episodeId && (
                    <div className="p-4 bg-white/5 border-t border-white/5">
                      <h4 className="text-xs font-bold text-white mb-2">Add Server to Episode #{episodes.find(e => e.id === addServerForm.episodeId)?.number}</h4>
                      <div className="grid grid-cols-4 gap-2">
                        <select value={addServerForm.language} onChange={(e) => setAddServerForm({...addServerForm, language: e.target.value})} className="bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white">
                          {Object.keys(LANGUAGE_DISPLAY_NAMES).map(lang => (
                            <option key={lang} value={lang}>{lang}</option>
                          ))}
                        </select>
                        <input type="text" value={addServerForm.serverName} onChange={(e) => setAddServerForm({...addServerForm, serverName: e.target.value})} placeholder="Server name" className="bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white" />
                        <input type="text" value={addServerForm.link} onChange={(e) => setAddServerForm({...addServerForm, link: e.target.value})} placeholder="Link" className="bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white col-span-2" />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={addServerToEpisode} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white">Add Server</button>
                        <button onClick={() => setAddServerForm({ episodeId: null, language: 'jap', serverName: '', link: '' })} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 text-white/50">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ==================== SCHEDULE ==================== */}
          {activeSection === 'schedule' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div><h2 className="text-xl font-black text-white">Schedule</h2></div>
                <div className="flex gap-2">
                  <button onClick={handleAutoSchedule} disabled={isImporting} className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600/20 text-cyan-400 border border-cyan-600/30 hover:bg-cyan-600/30 disabled:opacity-50 flex items-center gap-2">{isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}Auto-Fetch</button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 p-4 md:p-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div><label className="text-[10px] text-white/30">Day</label><select value={scheduleForm.day} onChange={(e) => setScheduleForm({...scheduleForm, day: parseInt(e.target.value)})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1">{DAYS.map((d,i)=><option key={i} value={i}>{d}</option>)}</select></div>
                  <div><label className="text-[10px] text-white/30">Time</label><input type="time" value={scheduleForm.time} onChange={(e) => setScheduleForm({...scheduleForm, time: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
                  <div><label className="text-[10px] text-white/30">Anime</label><select value={scheduleForm.anime_id || ''} onChange={(e) => { const id = e.target.value ? parseInt(e.target.value) : null; const anime = id ? animeList.find((a: any) => a.id === id) : null; setScheduleForm({...scheduleForm, anime_id: id, title: anime ? anime.title : ''}); }} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1"><option value="">Manual title</option>{animeList.map((a: any)=><option key={a.id} value={a.id}>{a.title}</option>)}</select></div>
                  <div><label className="text-[10px] text-white/30">Ep #</label><input type="number" value={scheduleForm.episode} onChange={(e) => setScheduleForm({...scheduleForm, episode: parseInt(e.target.value)||1})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
                  <div className="md:col-span-2"><label className="text-[10px] text-white/30">Title</label><input type="text" value={scheduleForm.title} onChange={(e) => setScheduleForm({...scheduleForm, title: e.target.value})} disabled={!!scheduleForm.anime_id} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1 disabled:opacity-50" /></div>
                  <div className="md:col-span-2"><label className="text-[10px] text-white/30">Link</label><input type="text" value={scheduleForm.link} onChange={(e) => setScheduleForm({...scheduleForm, link: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
                </div>
                <div className="flex gap-2"><button onClick={addSchedule} className="px-5 py-2.5 rounded-xl text-white font-bold text-xs" style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}>{editingSchedule ? 'Update' : 'Add'}</button>{editingSchedule && <button onClick={()=>{setEditingSchedule(null);setScheduleForm({day:1,time:'18:00',title:'',episode:1,link:'',anime_id:null});}} className="px-5 py-2.5 rounded-xl text-white/50 text-xs bg-white/5">Cancel</button>}</div>
              </div>
              <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.01)' }}>
                <div className="p-4 border-b border-white/5 flex justify-between"><h3 className="text-sm font-bold text-white">Weekly ({scheduleItems.length})</h3>{scheduleItems.length > 0 && <button onClick={clearAllSchedule} className="text-[10px] text-red-400">Clear All</button>}</div>
                {scheduleItems.length === 0 ? <div className="p-12 text-center text-white/20"><Calendar className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>No schedule</p></div> :
                  DAYS.map((day, i) => {
                    const items = scheduleItems.filter((s: any) => s.day === i).sort((a: any, b: any) => a.time.localeCompare(b.time));
                    if (!items.length) return null;
                    return (<div key={i}><div className="px-4 py-2 text-xs font-bold text-cyan-400 border-b border-white/5 bg-cyan-500/5">{day} ({items.length})</div>{items.map((item: any) => { const linked = item.anime_id ? animeList.find((a: any) => a.id === item.anime_id) : null; return (<div key={item.id} className="flex items-center gap-3 p-3 border-b border-white/5 group">{linked ? <div className="w-10 h-14 rounded-lg bg-cover shrink-0" style={{backgroundImage:`url(${linked.image})`}}/> : <div className="w-10 h-14 rounded-lg flex items-center justify-center shrink-0 bg-cyan-500/20"><Tv className="w-5 h-5 text-cyan-400"/></div>}<span className="text-xs text-white/60 w-12 font-bold">{item.time}</span><div className="flex-1"><p className="text-sm text-white font-bold truncate">{linked ? linked.title : item.title}</p><p className="text-xs text-white/30">Ep {item.episode}{linked && <span className="ml-2 text-cyan-400">★{linked.score}</span>}</p></div><div className="flex gap-1 opacity-0 group-hover:opacity-100"><button onClick={()=>editScheduleItem(item)} className="p-1.5 text-white/30 hover:text-blue-400"><Edit className="w-4 h-4"/></button><button onClick={()=>deleteScheduleItem(item.id)} className="p-1.5 text-white/30 hover:text-red-400"><Trash2 className="w-4 h-4"/></button></div></div>)})}</div>)})}
              </div>
            </div>
          )}

          {/* ==================== SLIDERS ==================== */}
          {activeSection === 'sliders' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div><h2 className="text-xl font-black text-white">Sliders</h2></div>
              </div>

              <div className="flex gap-2 border-b border-white/5 pb-2">
                <button
                  onClick={() => setSlidersTab('featured')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${slidersTab === 'featured' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/40 hover:text-white/70'}`}
                >
                  <Star className="w-4 h-4 inline mr-1" /> Featured
                </button>
                <button
                  onClick={() => setSlidersTab('newlyAdded')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${slidersTab === 'newlyAdded' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-white/40 hover:text-white/70'}`}
                >
                  <Gift className="w-4 h-4 inline mr-1" /> Newly Added
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type="text"
                  value={sliderSearch}
                  onChange={(e) => setSliderSearch(e.target.value)}
                  placeholder={`Search anime to add to ${slidersTab === 'featured' ? 'Featured' : 'Newly Added'}...`}
                  className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-purple-500 outline-none"
                />
              </div>

              <div className="rounded-2xl border border-white/5 p-4 md:p-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-xs text-white/30 mb-4">
                  {slidersTab === 'featured' ? 'Select 1-5 anime for the Featured slider' : 'Select anime to show in the Newly Added section (no limit)'}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                  {animeList
                    .filter(anime => anime.title.toLowerCase().includes(sliderSearch.toLowerCase()))
                    .map((anime: any) => {
                      const isSelected = currentIds.includes(anime.id);
                      return (
                        <button
                          key={anime.id}
                          onClick={() => toggleCurrent(anime.id)}
                          className={`rounded-2xl overflow-hidden border-2 transition-all ${isSelected ? 'border-amber-500' : 'border-transparent hover:border-white/10'}`}
                        >
                          <div className="aspect-[3/4] bg-cover bg-center relative" style={{ backgroundImage: `url(${anime.image})` }}>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80"/>
                            {isSelected && (
                              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                                <Star className="w-4 h-4 text-white fill-current"/>
                              </div>
                            )}
                            <div className="absolute bottom-3 left-3 right-3">
                              <p className="text-xs font-black text-white line-clamp-1">{anime.title}</p>
                              <p className="text-[10px] text-white/50">{anime.type} • ★{anime.score}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  {animeList.filter(a => a.title.toLowerCase().includes(sliderSearch.toLowerCase())).length === 0 && (
                    <div className="col-span-full text-center text-white/30 text-sm py-8">No anime found matching "{sliderSearch}"</div>
                  )}
                </div>
                <div className="border-t border-white/5 pt-4">
                  <h3 className="text-sm font-bold text-white mb-3">Order ({currentIds.length}{slidersTab === 'featured' ? '/5' : ''})</h3>
                  {currentIds.length === 0 ? (
                    <p className="text-xs text-zinc-500">No anime selected yet.</p>
                  ) : (
                    currentIds.map((id, idx) => {
                      const anime = animeList.find((a: any) => a.id === id);
                      if (!anime) return null;
                      return (
                        <div key={id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 mb-2">
                          <span className="text-lg font-black text-amber-500 w-8">#{idx + 1}</span>
                          <div className="w-10 h-14 rounded-lg bg-cover shrink-0" style={{ backgroundImage: `url(${anime.image})` }} />
                          <div className="flex-1">
                            <p className="text-sm text-white">{anime.title}</p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => moveCurrent(id, 'up')}
                              disabled={idx === 0}
                              className="p-1.5 text-white/30 disabled:opacity-20"
                            >
                              <ArrowLeft className="w-4 h-4 rotate-90" />
                            </button>
                            <button
                              onClick={() => moveCurrent(id, 'down')}
                              disabled={idx === currentIds.length - 1}
                              className="p-1.5 text-white/30 disabled:opacity-20"
                            >
                              <ArrowRight className="w-4 h-4 rotate-90" />
                            </button>
                            <button onClick={() => toggleCurrent(id)} className="p-1.5 text-white/30 hover:text-red-400">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== NEWS ==================== */}
          {activeSection === 'news' && (
            <div className="space-y-6">
              <div className="flex justify-between"><div><h2 className="text-xl font-black text-white">News</h2></div><button onClick={handleFetchNews} disabled={isImporting} className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600/20 text-emerald-400 border border-emerald-600/30">{isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : 'Fetch from API'}</button></div>
              <div className="rounded-2xl border border-white/5 p-4 md:p-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="space-y-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-[10px] text-white/30">Title</label><input type="text" value={newsForm.title} onChange={(e)=>setNewsForm({...newsForm,title:e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1"/></div><div><label className="text-[10px] text-white/30">Image URL</label><input type="text" value={newsForm.image} onChange={(e)=>setNewsForm({...newsForm,image:e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1"/></div></div>
                  <div><label className="text-[10px] text-white/30">Content</label><textarea rows={4} value={newsForm.content} onChange={(e)=>setNewsForm({...newsForm,content:e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1 resize-none"/></div>
                  <div><label className="text-[10px] text-white/30">Status</label><div className="flex gap-2 mt-1">{['draft','published'].map((s: any)=>(<button key={s} onClick={()=>setNewsForm({...newsForm,status:s})} className={`px-4 py-2 rounded-xl text-xs font-bold capitalize ${newsForm.status===s?'text-white':'text-white/40'}`} style={newsForm.status===s?{background:s==='published'?'rgba(16,185,129,0.3)':'rgba(245,158,11,0.3)'}:{}}>{s}</button>))}</div></div>
                </div>
                <div className="flex gap-2"><button onClick={saveNews} className="px-5 py-2.5 rounded-xl text-white font-bold text-xs" style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>{editingNews?'Update':'Publish'}</button>{editingNews&&<button onClick={()=>{setEditingNews(null);setNewsForm({title:'',content:'',image:'',status:'draft'});}} className="px-5 py-2.5 rounded-xl text-white/50 text-xs bg-white/5">Cancel</button>}</div>
              </div>
              <div className="space-y-3">
                {newsItems.length > 0 ? newsItems.map((item: any)=>(<div key={item.id} className="rounded-2xl border border-white/5 p-5" style={{background:'rgba(255,255,255,0.02)'}}><div className="flex justify-between mb-3"><div><h4 className="text-sm font-bold text-white">{item.title}</h4><p className="text-xs text-white/30">{item.date} • {item.author}</p></div><span className={`px-3 py-1 rounded-full text-[10px] font-bold ${item.status==='published'?'bg-emerald-500/20 text-emerald-400':'bg-amber-500/20 text-amber-400'}`}>{item.status}</span></div><p className="text-xs text-white/50 line-clamp-2">{item.content}</p><div className="flex gap-2 mt-4"><button onClick={()=>editNewsItem(item)} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/5 text-white/60 hover:text-white">Edit</button><button onClick={()=>deleteNewsItem(item.id)} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 text-red-400">Delete</button></div></div>)) : <div className="text-center py-8 text-white/30">No news articles yet.</div>}
              </div>
            </div>
          )}

          {/* ==================== CONTENT ==================== */}
          {activeSection === 'content' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div><h2 className="text-xl font-black text-white">Content & Reports</h2></div>
                <div className="flex gap-2">
                  <button onClick={loadReports} disabled={reportsLoading} className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 disabled:opacity-50 flex items-center gap-2">
                    <RefreshCw className={`w-3.5 h-3.5 ${reportsLoading ? 'animate-spin' : ''}`} />
                    Refresh Reports
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <button onClick={() => setContentLang(null)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${contentLang === null ? 'bg-white text-black' : 'bg-white/5 text-white/40'}`}>All</button>
                {allEpisodeDisplayNames.map((displayName) => (
                  <button
                    key={displayName}
                    onClick={() => setContentLang(displayName === contentLang ? null : displayName)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${contentLang === displayName ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/40'}`}
                  >
                    {displayName}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 flex-wrap">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20"/><input type="text" placeholder="Search..." value={contentSearch} onChange={(e) => setContentSearch(e.target.value)} className="bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white w-48"/></div>
                <select value={contentGenre} onChange={(e) => setContentGenre(e.target.value)} className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                  <option value="All">All Genres</option>
                  {ALL_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select value={contentType} onChange={(e) => setContentType(e.target.value)} className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                  {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {filteredAnime.length === 0 ? (
                <div className="text-center py-16 text-white/30"><Film className="w-16 h-16 mx-auto mb-4 opacity-30"/><p>No content found.</p></div>
              ) : (
                filteredAnime.map((anime: any) => {
                  const eps = episodes.filter((ep: any) => ep.anime_id == anime.id);
                  const animeReports = reports.filter((r: any) => r.animeId == anime.id);
                  return (
                    <div key={anime.id} className={`rounded-2xl border ${animeReports.length > 0 ? 'border-red-500/50' : 'border-white/5'} overflow-hidden`} style={{ background: 'rgba(255,255,255,0.01)' }}>
                      <div className="flex items-center gap-4 p-4 border-b border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="w-12 h-16 rounded-lg bg-cover shrink-0" style={{ backgroundImage: `url(${anime.image})` }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white">{anime.title}</p>
                          <p className="text-xs text-white/30">{anime.type} • {anime.genre?.split(',').slice(0,2).join(', ')} • ★{anime.score}</p>
                          {animeReports.length > 0 && (
                            <p className="text-xs text-red-400">⚠️ {animeReports.length} report{animeReports.length > 1 ? 's' : ''}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditAnime(anime)} className="p-2 text-white/30 hover:text-blue-400"><Edit className="w-4 h-4"/></button>
                          <button onClick={() => deleteAnime(anime.id)} className="p-2 text-white/30 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </div>
                      {animeReports.length > 0 && (
                        <div className="p-3 space-y-2 bg-red-500/5">
                          <p className="text-xs font-bold text-red-400">Reports ({animeReports.length})</p>
                          {animeReports.map((report: any) => (
                            <div key={report.id} className="flex items-center justify-between text-xs">
                              <div>
                                <span className="text-white/50">{report.serverName} Ep {report.episodeNumber}</span>
                                <span className="ml-2 text-red-300">{report.reason}</span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setQuickEditEp({ animeId: report.animeId, epNumber: report.episodeNumber });
                                    const ep = episodes.find((e: any) => e.anime_id == report.animeId && e.number == report.episodeNumber);
                                    if (ep) {
                                      const firstLang = Object.keys(ep.languages || {})[0] || '';
                                      setQuickEditUrl(ep.languages?.[firstLang] || '');
                                    }
                                  }}
                                  className="px-2 py-1 rounded bg-purple-600/20 text-purple-400 text-xs"
                                >
                                  Fix Link
                                </button>
                                <button onClick={() => deleteReport(report.id)} className="px-2 py-1 rounded bg-white/5 text-white/40 text-xs">Dismiss</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {eps.length > 0 && (
                        <div className="p-3">
                          <div className="flex gap-2 flex-wrap">
                            {eps.sort((a: any, b: any) => a.number - b.number).map((ep: any) => (
                              <div key={ep.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <span className="font-bold text-white/70">#{ep.number}</span>
                                <span className="text-white/30">{ep.title || 'Untitled'}</span>
                                {Object.keys(ep.languages || {}).map((l: any) => (
                                  <span key={l} className="text-[9px] text-white/20 bg-white/5 px-1 rounded">{getLanguageDisplay(l)}</span>
                                ))}
                                <button onClick={() => deleteEpisode(ep.id)} className="text-white/15 hover:text-red-400"><X className="w-3 h-3"/></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

        </main>
      </div>

      {/* EDIT ANIME MODAL */}
      {editAnimeModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setEditAnimeModal(null)}>
          <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-black text-white">Edit Anime</h3><button onClick={() => setEditAnimeModal(null)} className="p-1 text-white/40 hover:text-white"><X className="w-5 h-5" /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs text-white/50">Title</label><input type="text" value={editAnimeForm.title || ''} onChange={e => setEditAnimeForm({...editAnimeForm, title: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-white/50">Type</label><select value={editAnimeForm.type || 'TV'} onChange={e => setEditAnimeForm({...editAnimeForm, type: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1"><option>TV</option><option>Movie</option><option>OVA</option><option>Special</option></select></div>
                <div><label className="text-xs text-white/50">Status</label><select value={editAnimeForm.status || 'Ongoing'} onChange={e => setEditAnimeForm({...editAnimeForm, status: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1"><option>Ongoing</option><option>Completed</option><option>Upcoming</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-white/50">Episodes</label><input type="number" value={editAnimeForm.episodes || 0} onChange={e => setEditAnimeForm({...editAnimeForm, episodes: parseInt(e.target.value)})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
                <div><label className="text-xs text-white/50">Score</label><input type="number" step="0.1" value={editAnimeForm.score || 0} onChange={e => setEditAnimeForm({...editAnimeForm, score: parseFloat(e.target.value)})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
              </div>
              <div><label className="text-xs text-white/50">Year</label><input type="text" value={editAnimeForm.year || ''} onChange={e => setEditAnimeForm({...editAnimeForm, year: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
              <div><label className="text-xs text-white/50">Genre</label><select multiple value={(editAnimeForm.genre || '').split(', ').filter(Boolean)} onChange={e => { const selected = Array.from(e.target.selectedOptions, (o: any) => o.value); setEditAnimeForm({...editAnimeForm, genre: selected.join(', ')}); }} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1 h-32">{ALL_GENRES.map(g => <option key={g} value={g}>{g}</option>)}</select><p className="text-[9px] text-white/30 mt-1">Ctrl+Click to select multiple</p></div>
              <div><label className="text-xs text-white/50">Studio</label><input type="text" value={editAnimeForm.studio || ''} onChange={e => setEditAnimeForm({...editAnimeForm, studio: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
              <div><label className="text-xs text-white/50">Image URL</label><input type="text" value={editAnimeForm.image || ''} onChange={e => setEditAnimeForm({...editAnimeForm, image: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
              <div><label className="text-xs text-white/50">Description</label><textarea rows={3} value={editAnimeForm.description || ''} onChange={e => setEditAnimeForm({...editAnimeForm, description: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1 resize-none" /></div>
              <button onClick={saveAnimeEdit} className="w-full py-2.5 rounded-xl text-white font-bold bg-purple-600 hover:bg-purple-700 transition-all mt-2">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK EDIT LINK MODAL */}
      {quickEditEp && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setQuickEditEp(null)}>
          <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white mb-4">Fix Episode Link</h3>
            <p className="text-xs text-white/50 mb-2">Anime: {quickEditEp.animeId} | Episode: {quickEditEp.epNumber}</p>
            <input
              type="text"
              value={quickEditUrl}
              onChange={(e) => setQuickEditUrl(e.target.value)}
              placeholder="Paste new video URL..."
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => fixReportedLink(quickEditEp.animeId, quickEditEp.epNumber, quickEditUrl)} className="px-4 py-2 rounded-xl text-white font-bold text-sm bg-purple-600">Save Link</button>
              <button onClick={() => setQuickEditEp(null)} className="px-4 py-2 rounded-xl text-white/50 text-sm bg-white/5">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* SERVER MANAGEMENT MODAL */}
      {serverManagementModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setServerManagementModal(null)}>
          <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white">Manage Servers</h3>
              <button onClick={() => setServerManagementModal(null)} className="p-1 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-white/40 mb-4">Episode #{serverManagementModal.episode.number} – {serverManagementModal.animeTitle}</p>
            
            {Object.entries(serverManagementModal.episode.servers || {}).map(([lang, serversObj]) => {
              const serversRecord = serversObj as Record<string, string>;
              return (
                <div key={lang} className="mb-4 p-3 rounded-xl border border-white/5 bg-white/5">
                  <h4 className="text-sm font-bold text-white mb-2">{getLanguageDisplay(lang)}</h4>
                  {Object.entries(serversRecord).map(([serverName, url]) => (
                    <div key={serverName} className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-white/40 w-24 flex-shrink-0">{serverName}</span>
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => {
                          const updatedEp = { ...serverManagementModal.episode };
                          updatedEp.servers[lang][serverName] = e.target.value;
                          setServerManagementModal({ ...serverManagementModal, episode: updatedEp });
                        }}
                        className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={() => {
                          const newLink = serverManagementModal.episode.servers[lang][serverName];
                          editServerLink(serverManagementModal.episode.id, lang, serverName, newLink);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 flex-shrink-0"
                      >
                        Save
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
            
            <div className="text-xs text-white/30 mt-4 text-center">
              Tip: You can also use the "Add Server" button below the episode to add a new server.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}