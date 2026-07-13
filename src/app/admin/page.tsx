"use client";

import { useState, useEffect } from 'react';
import { 
  Film, Tv, Video, Calendar, Star, Globe, Settings,
  Plus, Edit, Trash2, Save, X, Search, Play, Download,
  Upload, Link, Image as ImageIcon, Hash, Type, AlignLeft, Tag,
  Users, Lock, LogOut, Monitor, Zap,
  RefreshCw, FolderOpen, BarChart3,
  Clock, Eye, Heart, Bookmark,
  ChevronDown, ChevronRight, ArrowLeft, ArrowRight,
  MoreVertical, Filter, Grid3x3, List,
  Sparkles, Wand2, Terminal,
  Activity, Gauge, Shield, AlertCircle, Check,
  ExternalLink, Copy, Clipboard, CheckCircle2, XCircle, AlertTriangle,
  Newspaper, Send, Database, Cloud, Server, ServerCrash,
  Flag, Gift
} from 'lucide-react';
import { combinedSearch, apiResultToAnime, getAniListTrending, getJikanTop, getJikanSeasonal, fetchAnimeNews } from '@/lib/animeApis';

// ---------- FIRESTORE (for live reports) ----------
import { db } from '@/lib/firebaseClient';
import { collection, query, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';

// Base languages – only the core three
const BASE_LANGUAGES = [
  { code: 'jap', name: 'Japanese', flag: '🇯🇵', type: 'SUB', base: true },
  { code: 'eng', name: 'English', flag: '🇬🇧', type: 'DUB', base: true },
  { code: 'hin', name: 'Hindi', flag: '🇮🇳', type: 'DUB', base: true },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const NAV_ITEMS = [
  { id: 'api-import', label: 'API Import', icon: Cloud, color: '#ec4899' },
  { id: 'import', label: 'Manual', icon: Download, color: '#f59e0b' },
  { id: 'episodes', label: 'Episodes', icon: Video, color: '#8b5cf6' },
  { id: 'schedule', label: 'Schedule', icon: Calendar, color: '#06b6d4' },
  { id: 'featured', label: 'Featured', icon: Star, color: '#f59e0b' },
  { id: 'newly-added', label: 'Newly Added', icon: Gift, color: '#10b981' },
  { id: 'news', label: 'News', icon: Newspaper, color: '#10b981' },
  { id: 'languages', label: 'Languages', icon: Globe, color: '#ef4444' },
  { id: 'all-content', label: 'Content', icon: FolderOpen, color: '#8b5cf6' },
  { id: 'reports', label: 'Reports', icon: Flag, color: '#ef4444' },
];

// ✅ FIXED: Type annotations added to endpoint, body, and id parameters
const API = {
  fetch: async (endpoint: string) => {
    const res = await fetch(`/api/${endpoint}`);
    return await res.json();
  },
  post: async (endpoint: string, body: any) => {
    const res = await fetch(`/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await res.json();
  },
  put: async (endpoint: string, body: any) => {
    const res = await fetch(`/api/${endpoint}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await res.json();
  },
  delete: async (endpoint: string, id: any) => {
    const res = await fetch(`/api/${endpoint}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    return await res.json();
  },
};

export default function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeSection, setActiveSection] = useState('api-import');
  const [notification, setNotification] = useState<{ msg: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [scheduleItems, setScheduleItems] = useState<any[]>([]);
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [newlyAddedIds, setNewlyAddedIds] = useState<string[]>([]);
  const [customLanguagesRaw, setCustomLanguagesRaw] = useState<any[]>([]);
  const [activeLanguage, setActiveLanguage] = useState('eng');
  
  // ---------- Reports state ----------
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  
  const [importQuery, setImportQuery] = useState('');
  const [importResults, setImportResults] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  
  const [selectedAnimeForEp, setSelectedAnimeForEp] = useState<any>(null);
  const [episodeForm, setEpisodeForm] = useState({ 
    number: 1, title: '', link: ''
  });
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  
  const [scheduleForm, setScheduleForm] = useState({ day: 1, time: '18:00', title: '', episode: 1, link: '', anime_id: null as any });
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  
  const [newsForm, setNewsForm] = useState({ title: '', content: '', image: '', status: 'draft' });
  const [editingNews, setEditingNews] = useState<any>(null);
  
  const [showAddLang, setShowAddLang] = useState(false);
  const [newLang, setNewLang] = useState({ code: '', name: '', flag: '', type: 'DUB' });
  const [editingLanguage, setEditingLanguage] = useState<any>(null);
  
  const [searchAnime, setSearchAnime] = useState('');
  const [editAnimeModal, setEditAnimeModal] = useState<any>(null);
  const [editAnimeForm, setEditAnimeForm] = useState<any>({});

  const ALL_GENRES = ["Action", "Adult", "Adult Cast", "Adventure", "Animation", "Anthropomorphic", "Award Winning", "Boys Love", "Comedy", "Crime", "Crossdressing", "Delinquents", "Drama", "Ecchi", "Family", "Fantasy", "Girls Love", "Gore", "Gourmet", "Harem", "Hentai", "High Stakes Game", "Historical", "Horror", "Isekai", "Josei", "Love Polygon", "Magical Sex Shift", "Martial Arts", "Mecha", "Medical", "Military", "Music", "Mystery", "Mythology", "Otaku Culture", "Parody", "Psychological", "Racing", "Reincarnation", "Romance", "Samurai", "School", "Sci-Fi", "Seinen", "Shoujo", "Shounen", "Sports", "Strategy Game", "Super Power", "Supernatural", "Survival", "Suspense", "Thriller", "Time Travel", "Urban Fantasy", "Vampire", "Video Game"];

  // ✅ TYPED showNotification
  const showNotification = (msg: string, type: string = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ✅ TYPED handleLogin
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/check-password', {
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

  // ----- Load reports from Firestore -----
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

  // Delete a resolved report
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

  // Load reports when section becomes active
  useEffect(() => {
    if (activeSection === 'reports') {
      loadReports();
    }
  }, [activeSection]);

  // ----- Display languages (unchanged) -----
  const displayLanguages = (() => {
    const langMap: Record<string, any> = {};
    BASE_LANGUAGES.forEach(lang => { langMap[lang.code] = { ...lang }; });
    customLanguagesRaw.forEach(lang => { langMap[lang.code] = { ...lang }; });
    return Object.values(langMap).filter((lang: any) => !lang.removed);
  })();

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [animeRes, episodesRes, scheduleRes, newsRes, featuredRes, newlyAddedRes, languagesRes] = await Promise.all([
        API.fetch('anime'), API.fetch('episodes'), API.fetch('schedule'),
        API.fetch('news'), API.fetch('featured'), API.fetch('newly-added'), API.fetch('languages'),
      ]);
      setAnimeList(Array.isArray(animeRes.anime) ? animeRes.anime : []);
      setEpisodes(Array.isArray(episodesRes.episodes) ? episodesRes.episodes : []);
      setScheduleItems(Array.isArray(scheduleRes.schedule) ? scheduleRes.schedule : []);
      setNewsItems(Array.isArray(newsRes.news) ? newsRes.news : []);
      setFeaturedIds(Array.isArray(featuredRes.featured) ? featuredRes.featured : []);
      setNewlyAddedIds(Array.isArray(newlyAddedRes.newlyAdded) ? newlyAddedRes.newlyAdded : []);
      const rawCustom = Array.isArray(languagesRes.languages) ? languagesRes.languages : [];
      setCustomLanguagesRaw(rawCustom);
    } catch (err) {
      showNotification('Failed to load data!', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { if (isLoggedIn) loadAllData(); }, [isLoggedIn]);

  // ✅ TYPED dedupeResults
  const dedupeResults = (results: any[]) => {
    const seen = new Set();
    return results.filter((item: any) => {
      const key = `${item.title?.toLowerCase().trim()}_${item.mal_id || item.anilist_id || item.kitsu_id || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // ----- Language helpers -----
  const getAllLanguagesForSave = () => {
    const langMap: Record<string, any> = {};
    BASE_LANGUAGES.forEach(lang => { langMap[lang.code] = { ...lang }; });
    customLanguagesRaw.forEach(lang => { langMap[lang.code] = { ...lang }; });
    return Object.values(langMap);
  };

  const getUniqueLanguages = () => {
    return displayLanguages;
  };

  const addLanguage = async () => { 
    if (!newLang.code || !newLang.name) { showNotification('Code and name required!', 'error'); return; }
    if (newLang.code.length !== 3) { showNotification('Code must be 3 letters!', 'error'); return; }
    
    const updated = customLanguagesRaw.filter((l: any) => l.code !== newLang.code);
    updated.push({ ...newLang, id: Date.now(), code: newLang.code.toLowerCase() });
    setCustomLanguagesRaw(updated);
    
    await API.put('languages', { languages: getAllLanguagesForSave() });
    
    setNewLang({ code: '', name: '', flag: '', type: 'DUB' });
    setShowAddLang(false);
    setEditingLanguage(null);
    showNotification(`Language "${newLang.name}" saved!`);
  };

  const updateLanguage = async () => {
    if (!newLang.code || !newLang.name) { showNotification('Code and name required!', 'error'); return; }
    
    const updated = customLanguagesRaw.filter((l: any) => l.code !== editingLanguage.code && l.code !== newLang.code);
    updated.push({ ...newLang, id: editingLanguage.id || Date.now(), code: newLang.code.toLowerCase() });
    setCustomLanguagesRaw(updated);
    
    await API.put('languages', { languages: getAllLanguagesForSave() });
    
    setNewLang({ code: '', name: '', flag: '', type: 'DUB' });
    setShowAddLang(false);
    setEditingLanguage(null);
    showNotification(`Language "${newLang.name}" updated!`);
  };

  // ✅ TYPED removeLanguage
  const removeLanguage = async (code: string) => {
    const updated = customLanguagesRaw.map((l: any) => {
      if (l.code === code) {
        return { ...l, removed: true, flag: '🚫', type: 'REMOVED' };
      }
      return l;
    });
    
    if (!updated.some((l: any) => l.code === code)) {
      const baseLang = BASE_LANGUAGES.find(l => l.code === code);
      if (baseLang) {
        updated.push({ 
          id: Date.now(), 
          code, 
          name: baseLang.name, 
          flag: '🚫', 
          type: 'REMOVED', 
          removed: true 
        });
      }
    }
    
    setCustomLanguagesRaw(updated);
    await API.put('languages', { languages: getAllLanguagesForSave() });
    showNotification('Language removed!');
  };

  // ✅ TYPED openEditAnime
  const openEditAnime = (anime: any) => { setEditAnimeModal(anime); setEditAnimeForm({ ...anime }); };
  const saveAnimeEdit = async () => {
    try {
      await API.put('anime', editAnimeForm);
      setAnimeList(prev => prev.map((a: any) => a.id === editAnimeForm.id ? { ...a, ...editAnimeForm } : a));
      setEditAnimeModal(null);
      showNotification('Anime updated!');
    } catch (err) { showNotification('Failed to update!', 'error'); }
  };

  const handleApiSearch = async () => {
    if (!importQuery.trim()) return;
    setIsImporting(true);
    try {
      const results = await combinedSearch(importQuery);
      setImportResults(dedupeResults(results));
      showNotification(results.length === 0 ? 'No results found!' : `Found ${results.length} results!`);
    } catch (err) { showNotification('API search failed!', 'error'); }
    setIsImporting(false);
  };

  const handleTrendingImport = async () => {
    setIsImporting(true);
    try { const results = await getAniListTrending(); setImportResults(dedupeResults(results)); showNotification(`Loaded ${results.length} trending!`); }
    catch (err) { showNotification('Failed!', 'error'); }
    setIsImporting(false);
  };

  const handleTopImport = async () => {
    setIsImporting(true);
    try { const results = await getJikanTop('anime', 'bypopularity', 15); setImportResults(dedupeResults(results)); showNotification(`Loaded ${results.length} top!`); }
    catch (err) { showNotification('Failed!', 'error'); }
    setIsImporting(false);
  };

  const handleSeasonalImport = async () => {
    setIsImporting(true);
    try { const results = await getJikanSeasonal(null, null); setImportResults(dedupeResults(results)); showNotification(`Loaded ${results.length} seasonal!`); }
    catch (err) { showNotification('Failed!', 'error'); }
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
      let lastError = '';
      const existingTitles = new Set(newsItems.map((n: any) => n.title));

      for (const newsItem of newsResults) {
        if (existingTitles.has(newsItem.title)) continue;

        const result = await API.post('news', {
          title: newsItem.title,
          content: newsItem.content,
          image: newsItem.image,
          status: 'draft'
        });

        if (result.success && result.news) {
          added++;
          existingTitles.add(newsItem.title);
        } else {
          lastError = result.error || 'Unknown error';
          console.error('Failed to add news:', newsItem.title, lastError);
        }
      }

      await loadAllData();

      if (added > 0) {
        showNotification(`Imported ${added} new articles!`);
      } else if (lastError) {
        showNotification(`No articles imported. Last error: ${lastError}`, 'error');
      } else {
        showNotification('No new articles to import (all already exist)');
      }
    } catch (err) {
      showNotification('Failed to fetch news!', 'error');
    }
    setIsImporting(false);
  };

  // ✅ TYPED importApiResult
  const importApiResult = async (apiItem: any) => {
    const animeData = apiResultToAnime(apiItem);
    try {
      const result = await API.post('anime', animeData);
      if (result.success && result.anime) {
        setAnimeList(prev => [...prev, result.anime]);
        setImportResults(prev => prev.filter((r: any) => r.id !== apiItem.id));
        showNotification(`${animeData.title} imported!`);
      } else {
        await loadAllData();
        setImportResults(prev => prev.filter((r: any) => r.id !== apiItem.id));
        showNotification(`${animeData.title} imported!`);
      }
    } catch (err) { showNotification('Import failed!', 'error'); }
  };

  const importAllResults = async () => {
    setIsImporting(true);
    let count = 0;
    for (const item of importResults) {
      try { await API.post('anime', apiResultToAnime(item)); count++; } catch (err) {}
    }
    await loadAllData();
    setImportResults([]);
    showNotification(`Imported ${count} anime!`);
    setIsImporting(false);
  };

  const handleManualImport = () => {
    if (!importQuery.trim()) return;
    setIsImporting(true);
    setTimeout(() => {
      setImportResults([
        { id: 'man-1', title: importQuery || "Solo Leveling", type: "TV", year: "2024", score: 9.5, episodes: 12, genre: "Action, Fantasy", studio: "A-1 Pictures", image: "https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?w=200&q=80", description: "Sung Jin-Woo becomes the Shadow Monarch.", source: 'manual' },
        { id: 'man-2', title: "Kaiju No. 8", type: "TV", year: "2024", score: 8.7, episodes: 12, genre: "Action, Sci-Fi", studio: "Production I.G", image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=200&q=80", description: "Kafka Hibino gains kaiju powers.", source: 'manual' },
        { id: 'man-3', title: "Frieren: Beyond Journey's End", type: "TV", year: "2023", score: 9.4, episodes: 28, genre: "Fantasy, Drama", studio: "Madhouse", image: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=200&q=80", description: "An elven mage reflects on her journey.", source: 'manual' },
      ]);
      setIsImporting(false);
    }, 1500);
  };

  // ✅ TYPED importSingle
  const importSingle = async (item: any) => {
    const newAnime = { title: item.title, type: item.type, status: 'Ongoing', episodes: item.episodes, score: item.score, year: item.year, genre: item.genre, studio: item.studio, image: item.image, description: item.description || '' };
    try {
      const result = await API.post('anime', newAnime);
      if (result.success && result.anime) {
        setAnimeList(prev => [...prev, result.anime]);
        setImportResults(prev => prev.filter((r: any) => r.id !== item.id));
        showNotification(`${item.title} imported!`);
      } else { await loadAllData(); showNotification(`${item.title} imported!`); }
    } catch (err) { showNotification('Failed!', 'error'); }
  };

  const addEpisode = async () => {
    if (!selectedAnimeForEp) {
      showNotification('Please select an anime first.', 'error');
      return;
    }

    const link = episodeForm.link.trim();
    if (!link) {
      showNotification('Please enter a video link for the selected language.', 'error');
      return;
    }

    const servers = { [activeLanguage]: { "Server 1": link } };
    const languages = { [activeLanguage]: link };

    const epData = {
      anime_id: selectedAnimeForEp.id,
      number: episodeForm.number,
      title: episodeForm.title,
      languages: languages,
      servers: servers,
    };

    try {
      let result;
      if (editingEpisodeId) {
        const existingEp = episodes.find((ep: any) => ep.id === editingEpisodeId);
        if (existingEp) {
          const mergedLanguages = { ...(existingEp.languages || {}) };
          const mergedServers = { ...(existingEp.servers || {}) };
          mergedLanguages[activeLanguage] = link;
          mergedServers[activeLanguage] = { "Server 1": link };
          epData.languages = mergedLanguages;
          epData.servers = mergedServers;
        }
        result = await API.put('episodes', { id: editingEpisodeId, ...epData });
      } else {
        result = await API.post('episodes', epData);
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
        setEpisodeForm({
          number: episodeForm.number + 1,
          title: '',
          link: '',
        });
      } else {
        const errorMsg = result.error || 'Unknown error';
        showNotification(`Failed to save episode: ${errorMsg}`, 'error');
        console.error('Episode API error:', result);
      }
    } catch (err: any) {
      showNotification('Network error while saving episode.', 'error');
      console.error('Episode save error:', err);
    }
  };

  // ✅ TYPED editEpisode
  const editEpisode = (ep: any) => {
    setEditingEpisodeId(ep.id);
    const langKeys = Object.keys(ep.servers || {});
    const firstLang = langKeys.length > 0 ? langKeys[0] : 'eng';
    setActiveLanguage(firstLang);
    const link = (ep.servers?.[firstLang] && Object.values(ep.servers[firstLang])[0]) 
                 || ep.languages?.[firstLang] 
                 || '';
    setEpisodeForm({
      number: ep.number,
      title: ep.title || '',
      link: link
    });
    const anime = animeList.find((a: any) => a.id == ep.anime_id);
    if (anime) setSelectedAnimeForEp(anime);
    setActiveSection('episodes');
  };

  // ✅ TYPED handleLanguageChange
  const handleLanguageChange = (langCode: string) => {
    setActiveLanguage(langCode);
    if (editingEpisodeId) {
      const ep = episodes.find((e: any) => e.id === editingEpisodeId);
      if (ep) {
        const link = (ep.servers?.[langCode] && Object.values(ep.servers[langCode])[0]) 
                     || ep.languages?.[langCode] 
                     || '';
        setEpisodeForm(prev => ({ ...prev, link }));
      }
    } else {
      setEpisodeForm(prev => ({ ...prev, link: '' }));
    }
  };

  // ✅ TYPED deleteEpisode
  const deleteEpisode = async (id: any) => {
    try {
      await API.delete('episodes', id);
      setEpisodes(prev => prev.filter((ep: any) => ep.id !== id));
      if (editingEpisodeId === id) { setEditingEpisodeId(null); setEpisodeForm({ number: 1, title: '', link: '' }); }
      showNotification('Episode deleted!');
    } catch (err) { showNotification('Failed!', 'error'); }
  };

  // ---- ADD SCHEDULE (with live notification) ----
  const addSchedule = async () => {
    if (!scheduleForm.title && !scheduleForm.anime_id) { showNotification('Select anime or enter title!', 'error'); return; }
    try {
      if (editingSchedule) {
        await API.put('schedule', { id: editingSchedule.id, ...scheduleForm });
        setScheduleItems(prev => prev.map((s: any) => s.id === editingSchedule.id ? { ...s, ...scheduleForm } : s));
        setEditingSchedule(null); showNotification('Updated!');
        // ---- SEND LIVE NOTIFICATION ----
        fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '📅 Schedule Updated!',
            body: `${scheduleForm.title || 'Anime'} – Episode ${scheduleForm.episode} on ${DAYS[scheduleForm.day]} at ${scheduleForm.time}`,
            icon: 'https://yourdomain.com/favicon.ico',
          }),
        }).catch(() => {});
      } else {
        const result = await API.post('schedule', scheduleForm);
        if (result.success && result.item) {
          setScheduleItems(prev => [...prev, result.item]);
          // ---- SEND LIVE NOTIFICATION ----
          fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: '📅 New Anime Airing!',
              body: `${scheduleForm.title || 'Anime'} – Episode ${scheduleForm.episode} on ${DAYS[scheduleForm.day]} at ${scheduleForm.time}`,
              icon: 'https://yourdomain.com/favicon.ico',
            }),
          }).catch(() => {});
        } else await loadAllData();
        showNotification('Added!');
      }
      setScheduleForm({ day: 1, time: '18:00', title: '', episode: 1, link: '', anime_id: null });
    } catch (err) { showNotification('Failed!', 'error'); }
  };

  // ✅ TYPED editScheduleItem
  const editScheduleItem = (item: any) => { 
    setEditingSchedule(item); 
    setScheduleForm({ day: item.day, time: item.time, title: item.title, episode: item.episode, link: item.link, anime_id: item.anime_id }); 
    setActiveSection('schedule'); 
  };

  // ✅ TYPED deleteScheduleItem
  const deleteScheduleItem = async (id: any) => { await API.delete('schedule', id); setScheduleItems(prev => prev.filter((s: any) => s.id !== id)); showNotification('Deleted!'); };

  const handleAutoSchedule = async () => {
    setIsImporting(true);
    try {
      const trending = await getAniListTrending();
      if (!trending.length) { showNotification('No data!', 'error'); setIsImporting(false); return; }
      const timeSlots = ['09:00', '12:00', '15:00', '18:00', '20:00', '22:00', '23:30'];
      for (let i = 0; i < Math.min(trending.length, 7); i++) {
        await API.post('schedule', { day: i % 7, time: timeSlots[i % timeSlots.length], title: trending[i].title, episode: 1, link: '', anime_id: null });
      }
      await loadAllData();
      showNotification(`Added ${Math.min(trending.length, 7)} shows!`);
    } catch (err) { showNotification('Failed!', 'error'); }
    setIsImporting(false);
  };

  const clearAllSchedule = async () => {
    if (!confirm('Delete all schedule items?')) return;
    try { for (const item of scheduleItems) await API.delete('schedule', item.id); setScheduleItems([]); showNotification('Cleared!'); }
    catch (err) { showNotification('Failed!', 'error'); }
  };

  // ✅ TYPED toggleFeatured
  const toggleFeatured = async (id: string) => {
    let newFeatured: string[];
    if (featuredIds.includes(id)) { if (featuredIds.length <= 1) { showNotification('Need at least 1!', 'error'); return; } newFeatured = featuredIds.filter(fid => fid !== id); }
    else { if (featuredIds.length >= 5) { showNotification('Max 5!', 'error'); return; } newFeatured = [...featuredIds, id]; }
    setFeaturedIds(newFeatured); await API.put('featured', { ids: newFeatured });
  };

  // ✅ TYPED moveFeatured
  const moveFeatured = async (id: string, dir: string) => {
    const idx = featuredIds.indexOf(id);
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === featuredIds.length - 1)) return;
    const newOrder = [...featuredIds];
    [newOrder[idx], newOrder[dir === 'up' ? idx - 1 : idx + 1]] = [newOrder[dir === 'up' ? idx - 1 : idx + 1], newOrder[idx]];
    setFeaturedIds(newOrder); await API.put('featured', { ids: newOrder });
  };

  // ---- Newly Added (identical to Featured) ----
  // ✅ TYPED toggleNewlyAdded
  const toggleNewlyAdded = async (id: string) => {
    let updated: string[];
    if (newlyAddedIds.includes(id)) {
      updated = newlyAddedIds.filter(fid => fid !== id);
    } else {
      updated = [...newlyAddedIds, id];
    }
    setNewlyAddedIds(updated);
    await API.put('newly-added', { ids: updated });
  };

  // ✅ TYPED moveNewlyAdded
  const moveNewlyAdded = async (id: string, dir: string) => {
    const idx = newlyAddedIds.indexOf(id);
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === newlyAddedIds.length - 1)) return;
    const newOrder = [...newlyAddedIds];
    [newOrder[idx], newOrder[dir === 'up' ? idx - 1 : idx + 1]] = [newOrder[dir === 'up' ? idx - 1 : idx + 1], newOrder[idx]];
    setNewlyAddedIds(newOrder);
    await API.put('newly-added', { ids: newOrder });
  };

  // ---- SAVE NEWS (with live notification) ----
  const saveNews = async () => {
    if (!newsForm.title) return;
    try {
      if (editingNews) {
        await API.put('news', { id: editingNews.id, ...newsForm });
        setNewsItems(prev => prev.map((n: any) => n.id === editingNews.id ? { ...n, ...newsForm } : n));
        setEditingNews(null);
        showNotification('Updated!');
        // ---- SEND LIVE NOTIFICATION ----
        fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '📰 News Updated!',
            body: newsForm.title,
            icon: newsForm.image || 'https://yourdomain.com/favicon.ico',
          }),
        }).catch(() => {});
      } else { 
        const exists = newsItems.some((n: any) => n.title === newsForm.title && n.content === newsForm.content);
        if (exists) { showNotification('Duplicate article!', 'error'); return; }
        const result = await API.post('news', newsForm); 
        if (result.success && result.news) {
          setNewsItems(prev => [...prev, result.news]);
          // ---- SEND LIVE NOTIFICATION ----
          fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: '📰 New Anime News!',
              body: newsForm.title,
              icon: newsForm.image || 'https://yourdomain.com/favicon.ico',
            }),
          }).catch(() => {});
        }
        showNotification('Published!'); 
      }
      setNewsForm({ title: '', content: '', image: '', status: 'draft' });
    } catch (err) { showNotification('Failed!', 'error'); }
  };

  // ✅ TYPED editNewsItem
  const editNewsItem = (item: any) => { setEditingNews(item); setNewsForm({ title: item.title, content: item.content, image: item.image, status: item.status }); setActiveSection('news'); };
  
  // ✅ TYPED deleteNewsItem
  const deleteNewsItem = async (id: any) => { await API.delete('news', id); setNewsItems(prev => prev.filter((n: any) => n.id !== id)); showNotification('Deleted!'); };

  // ✅ TYPED deleteAnime
  const deleteAnime = async (id: any) => {
    try { await API.delete('anime', id); setAnimeList(prev => prev.filter((a: any) => a.id !== id)); setEpisodes(prev => prev.filter((ep: any) => ep.anime_id != id)); if (featuredIds.includes(id)) { const nf = featuredIds.filter(fid => fid !== id); setFeaturedIds(nf); await API.put('featured', { ids: nf }); } if (newlyAddedIds.includes(id)) { const nf = newlyAddedIds.filter(fid => fid !== id); setNewlyAddedIds(nf); await API.put('newly-added', { ids: nf }); } showNotification('Deleted!'); }
    catch (err) { showNotification('Failed!', 'error'); }
  };

  // ==================== LOGIN (secure) ====================
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

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/5 px-4 md:px-6 py-3 flex items-center justify-between" style={{ background: 'rgba(6,6,8,0.95)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}><Zap className="w-5 h-5 text-white" /></div><h1 className="text-sm font-black text-white">CMS</h1></div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {NAV_ITEMS.map((item) => { const Icon = item.icon; return (<button key={item.id} onClick={() => setActiveSection(item.id)} className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activeSection === item.id ? 'text-white' : 'text-white/35 hover:text-white/70'}`} style={activeSection === item.id ? { background: `${item.color}20` } : {}}><Icon className="w-3.5 h-3.5" style={{ color: activeSection === item.id ? item.color : undefined }} />{item.label}</button>); })}
          <button onClick={() => { setIsLoggedIn(false); setPassword(''); }} className="p-2 rounded-xl text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all ml-1"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* MOBILE NAV */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 px-2 py-2 flex gap-1 overflow-x-auto" style={{ background: 'rgba(6,6,8,0.98)' }}>
          {NAV_ITEMS.map((item) => { const Icon = item.icon; const isActive = activeSection === item.id; return (<button key={item.id} onClick={() => setActiveSection(item.id)} className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-[9px] font-bold transition-all shrink-0 ${isActive ? 'text-white' : 'text-white/30'}`} style={isActive ? { background: `${item.color}20` } : {}}><Icon className="w-4 h-4" style={{ color: isActive ? item.color : undefined }} />{item.label}</button>); })}
        </div>

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-y-auto max-w-6xl mx-auto w-full">
          
          {/* API IMPORT */}
          {activeSection === 'api-import' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center"><div><h2 className="text-xl font-black text-white">API Import</h2><p className="text-white/30 text-xs mt-1">Search Jikan, AniList & Kitsu</p></div><span className="px-3 py-1 rounded-lg text-[10px] font-bold bg-pink-500/20 text-pink-400 border border-pink-500/30">Real Data</span></div>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[{ label: 'Anime', value: animeList.length },{ label: 'Episodes', value: episodes.length },{ label: 'Scheduled', value: scheduleItems.length },{ label: 'News', value: newsItems.length }].map((s, i) => (<div key={i} className="rounded-2xl p-4 border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}><p className="text-xs text-white/30">{s.label}</p><p className="text-2xl font-black text-white mt-1">{s.value}</p></div>))}</div>
            </div>
          )}

          {/* MANUAL IMPORT */}
          {activeSection === 'import' && (
            <div className="space-y-6">
              <div><h2 className="text-xl font-black text-white">Manual Import</h2></div>
              <div className="rounded-2xl border border-white/5 p-4 md:p-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex gap-3"><input type="text" value={importQuery} onChange={(e) => setImportQuery(e.target.value)} placeholder="Search..." className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white" onKeyDown={(e) => e.key === 'Enter' && handleManualImport()} /><button onClick={handleManualImport} className="px-5 py-3 rounded-xl text-white font-bold text-xs" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>Search</button></div>
                {importResults.length > 0 && (<div className="mt-6 space-y-3">{importResults.map((item) => (<div key={item.id} className="flex items-center gap-4 p-4 rounded-xl border border-white/5"><div className="w-14 h-20 rounded-lg bg-cover shrink-0" style={{ backgroundImage: `url(${item.image})` }} /><div className="flex-1"><p className="text-sm text-white font-bold">{item.title}</p><p className="text-xs text-white/30">{item.type} • {item.studio} • ★{item.score}</p></div><button onClick={() => importSingle(item)} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600/80">Import</button></div>))}</div>)}
              </div>
            </div>
          )}

          {/* EPISODES */}
          {activeSection === 'episodes' && (
            <div className="space-y-6">
              <div><h2 className="text-xl font-black text-white">Episode Manager</h2></div>
              <div className="rounded-2xl border border-white/5 p-4 md:p-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <select
                  onChange={(e) => {
                    const anime = animeList.find((a: any) => a.id === e.target.value);
                    setSelectedAnimeForEp(anime);
                    if (anime && !editingEpisodeId) {
                      const maxEp = Math.max(0, ...episodes.filter((ep: any) => ep.anime_id == anime.id).map((ep: any) => ep.number));
                      setEpisodeForm({ number: maxEp + 1, title: '', link: '' });
                    }
                  }}
                  value={selectedAnimeForEp?.id || ''}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white mb-4"
                >
                  <option value="">Choose anime...</option>
                  {animeList.map((a: any) => <option key={a.id} value={a.id}>{a.title} [{a.type}]</option>)}
                </select>
                {selectedAnimeForEp && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}><Film className="w-6 h-6 text-purple-400" /><div><p className="text-sm font-bold text-white">{selectedAnimeForEp.title}</p></div></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div><label className="text-[10px] text-white/30">Episode #</label><input type="number" value={episodeForm.number} onChange={(e) => setEpisodeForm({...episodeForm, number: parseInt(e.target.value) || 1})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
                      <div className="md:col-span-2"><label className="text-[10px] text-white/30">Title</label><input type="text" value={episodeForm.title} onChange={(e) => setEpisodeForm({...episodeForm, title: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30">Language</label>
                      <div className="flex gap-1.5 flex-wrap mb-3">
                        {getUniqueLanguages().map((lang: any) => (
                          <button 
                            key={lang.code} 
                            onClick={() => handleLanguageChange(lang.code)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${activeLanguage === lang.code ? 'text-white bg-purple-500/30' : 'text-white/40'}`}
                          >
                            {lang.flag} {lang.code.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30">Link for {activeLanguage.toUpperCase()}</label>
                      <input
                        type="text"
                        value={episodeForm.link}
                        onChange={(e) => setEpisodeForm({...episodeForm, link: e.target.value})}
                        placeholder={`Paste video URL for ${activeLanguage.toUpperCase()}...`}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addEpisode} className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>{editingEpisodeId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{editingEpisodeId ? 'Update' : 'Add Episode'}</button>
                      {editingEpisodeId && <button onClick={() => { setEditingEpisodeId(null); setEpisodeForm({ number: 1, title: '', link: '' }); }} className="px-6 py-3 rounded-xl text-white/50 text-sm bg-white/5">Cancel</button>}
                    </div>
                  </div>
                )}
              </div>
              {selectedAnimeForEp && (
                <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.01)' }}>
                  <div className="p-4 border-b border-white/5"><h3 className="text-sm font-bold text-white">Episodes ({episodes.filter((ep: any) => ep.anime_id == selectedAnimeForEp?.id).length})</h3></div>
                  {episodes.filter((ep: any) => ep.anime_id == selectedAnimeForEp?.id).sort((a: any, b: any) => a.number - b.number).map((ep: any) => (
                    <div key={ep.id} className="flex items-center gap-4 p-4 border-b border-white/5 hover:bg-white/[0.01]">
                      <div className="w-12 h-8 rounded-lg flex items-center justify-center text-sm font-black text-white bg-purple-500/30">#{ep.number}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">{ep.title || `Episode ${ep.number}`}</p>
                        <div className="flex gap-2 mt-1">
                          {Object.keys(ep.languages || {}).map(lang => (
                            <span key={lang} className="text-[9px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded">{lang.toUpperCase()}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => editEpisode(ep)} className="p-2 text-white/30 hover:text-blue-400"><Edit className="w-4 h-4"/></button>
                        <button onClick={() => deleteEpisode(ep.id)} className="p-2 text-white/30 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SCHEDULE */}
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

          {/* FEATURED */}
          {activeSection === 'featured' && (
            <div className="space-y-6">
              <div><h2 className="text-xl font-black text-white">Featured Slider</h2><p className="text-white/30 text-xs mt-1">Select 1-5 anime for homepage</p></div>
              <div className="rounded-2xl border border-white/5 p-4 md:p-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                  {animeList.map((anime: any) => {const isFeat=featuredIds.includes(anime.id);return(<button key={anime.id} onClick={()=>toggleFeatured(anime.id)} className={`rounded-2xl overflow-hidden border-2 transition-all ${isFeat?'border-amber-500':'border-transparent hover:border-white/10'}`}><div className="aspect-[3/4] bg-cover bg-center relative" style={{backgroundImage:`url(${anime.image})`}}><div className="absolute inset-0 bg-gradient-to-t from-black/80"/>{isFeat&&<div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center"><Star className="w-4 h-4 text-white fill-current"/></div>}<div className="absolute bottom-3 left-3 right-3"><p className="text-xs font-black text-white line-clamp-1">{anime.title}</p><p className="text-[10px] text-white/50">{anime.type} • ★{anime.score}</p></div></div></button>)})}
                </div>
                <div className="border-t border-white/5 pt-4"><h3 className="text-sm font-bold text-white mb-3">Order ({featuredIds.length}/5)</h3>
                  {featuredIds.map((id,idx)=>{const anime=animeList.find((a: any)=>a.id===id);if(!anime)return null;return(<div key={id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5"><span className="text-lg font-black text-amber-500 w-8">#{idx+1}</span><div className="w-10 h-14 rounded-lg bg-cover shrink-0" style={{backgroundImage:`url(${anime.image})`}}/><div className="flex-1"><p className="text-sm text-white">{anime.title}</p></div><div className="flex gap-1"><button onClick={()=>moveFeatured(id,'up')} disabled={idx===0} className="p-1.5 text-white/30 disabled:opacity-20"><ArrowLeft className="w-4 h-4 rotate-90"/></button><button onClick={()=>moveFeatured(id,'down')} disabled={idx===featuredIds.length-1} className="p-1.5 text-white/30 disabled:opacity-20"><ArrowRight className="w-4 h-4 rotate-90"/></button><button onClick={()=>toggleFeatured(id)} className="p-1.5 text-white/30 hover:text-red-400"><X className="w-4 h-4"/></button></div></div>)})}
                </div>
              </div>
            </div>
          )}

          {/* NEWLY ADDED */}
          {activeSection === 'newly-added' && (
            <div className="space-y-6">
              <div><h2 className="text-xl font-black text-white">Newly Added</h2><p className="text-white/30 text-xs mt-1">Select anime to show in the Newly Added section (no limit)</p></div>
              <div className="rounded-2xl border border-white/5 p-4 md:p-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                  {animeList.map((anime: any) => {const isAdded=newlyAddedIds.includes(anime.id);return(<button key={anime.id} onClick={()=>toggleNewlyAdded(anime.id)} className={`rounded-2xl overflow-hidden border-2 transition-all ${isAdded?'border-emerald-500':'border-transparent hover:border-white/10'}`}><div className="aspect-[3/4] bg-cover bg-center relative" style={{backgroundImage:`url(${anime.image})`}}><div className="absolute inset-0 bg-gradient-to-t from-black/80"/>{isAdded&&<div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-4 h-4 text-white"/></div>}<div className="absolute bottom-3 left-3 right-3"><p className="text-xs font-black text-white line-clamp-1">{anime.title}</p><p className="text-[10px] text-white/50">{anime.type} • ★{anime.score}</p></div></div></button>)})}
                </div>
                <div className="border-t border-white/5 pt-4"><h3 className="text-sm font-bold text-white mb-3">Order ({newlyAddedIds.length})</h3>
                  {newlyAddedIds.length === 0 ? <p className="text-xs text-zinc-500">No anime selected yet.</p> :
                    newlyAddedIds.map((id,idx)=>{const anime=animeList.find((a: any)=>a.id===id);if(!anime)return null;return(<div key={id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5"><span className="text-lg font-black text-emerald-500 w-8">#{idx+1}</span><div className="w-10 h-14 rounded-lg bg-cover shrink-0" style={{backgroundImage:`url(${anime.image})`}}/><div className="flex-1"><p className="text-sm text-white">{anime.title}</p></div><div className="flex gap-1"><button onClick={()=>moveNewlyAdded(id,'up')} disabled={idx===0} className="p-1.5 text-white/30 disabled:opacity-20"><ArrowLeft className="w-4 h-4 rotate-90"/></button><button onClick={()=>moveNewlyAdded(id,'down')} disabled={idx===newlyAddedIds.length-1} className="p-1.5 text-white/30 disabled:opacity-20"><ArrowRight className="w-4 h-4 rotate-90"/></button><button onClick={()=>toggleNewlyAdded(id)} className="p-1.5 text-white/30 hover:text-red-400"><X className="w-4 h-4"/></button></div></div>)})}
                </div>
              </div>
            </div>
          )}

          {/* NEWS */}
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

          {/* LANGUAGES */}
          {activeSection === 'languages' && (
            <div className="space-y-6">
              <div className="flex justify-between">
                <div><h2 className="text-xl font-black text-white">Languages</h2><p className="text-white/30 text-xs mt-1">Manage all languages – add, edit, or remove any</p></div>
                <button onClick={() => { setShowAddLang(!showAddLang); setEditingLanguage(null); setNewLang({ code: '', name: '', flag: '', type: 'DUB' }); }} className="px-4 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-2" style={{background:'linear-gradient(135deg,#ef4444,#dc2626)'}}>
                  <Plus className="w-4 h-4"/> Add Language
                </button>
              </div>

              {showAddLang && (
                <div className="rounded-2xl border border-red-500/20 p-4" style={{background:'rgba(239,68,68,0.05)'}}>
                  <h3 className="text-sm font-bold text-white mb-4">{editingLanguage ? 'Edit Language' : 'Add New Language'}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><label className="text-[10px] text-white/30">Code (3 letters)</label><input type="text" maxLength={3} value={newLang.code} onChange={(e) => setNewLang({...newLang, code: e.target.value.toLowerCase()})} placeholder="e.g. spa" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
                    <div><label className="text-[10px] text-white/30">Name</label><input type="text" value={newLang.name} onChange={(e) => setNewLang({...newLang, name: e.target.value})} placeholder="e.g. Spanish" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
                    <div><label className="text-[10px] text-white/30">Flag Emoji</label><input type="text" value={newLang.flag} onChange={(e) => setNewLang({...newLang, flag: e.target.value})} placeholder="e.g. 🇪🇸" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1" /></div>
                    <div><label className="text-[10px] text-white/30">Type</label><select value={newLang.type} onChange={(e) => setNewLang({...newLang, type: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mt-1"><option>DUB</option><option>SUB</option></select></div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={editingLanguage ? updateLanguage : addLanguage} className="px-5 py-2.5 rounded-xl text-white text-xs font-bold" style={{background:'#ef4444'}}>{editingLanguage ? 'Update' : 'Save'}</button>
                    <button onClick={() => { setShowAddLang(false); setEditingLanguage(null); setNewLang({ code: '', name: '', flag: '', type: 'DUB' }); }} className="px-5 py-2.5 rounded-xl text-white/50 text-xs bg-white/5">Cancel</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {displayLanguages.map((lang: any) => (
                  <div key={lang.code} className="rounded-2xl border border-white/5 p-4 flex items-center gap-3 group relative" style={{background:'rgba(255,255,255,0.02)'}}>
                    <span className="text-2xl">{lang.flag || '🏳️'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-bold truncate">{lang.name}</p>
                      <p className="text-[10px] text-white/30 uppercase">{lang.code} • {lang.type}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingLanguage(lang); setNewLang({ code: lang.code, name: lang.name, flag: lang.flag, type: lang.type }); setShowAddLang(true); }} className="p-1.5 text-white/30 hover:text-blue-400 transition-colors" title="Edit"><Edit className="w-3.5 h-3.5"/></button>
                      <button onClick={() => { if (confirm(`Remove "${lang.name}" language?`)) removeLanguage(lang.code); }} className="p-1.5 text-white/30 hover:text-red-400 transition-colors" title="Remove"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ALL CONTENT */}
          {activeSection === 'all-content' && (
            <div className="space-y-6">
              <div className="flex justify-between flex-wrap gap-3"><div><h2 className="text-xl font-black text-white">All Content</h2><p className="text-white/30 text-xs mt-1">{animeList.length} anime • {episodes.length} episodes</p></div><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20"/><input type="text" placeholder="Search..." value={searchAnime} onChange={(e)=>setSearchAnime(e.target.value)} className="bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white w-48"/></div></div>
              {animeList.length===0?<div className="text-center py-16 text-white/30"><Film className="w-16 h-16 mx-auto mb-4 opacity-30"/><p>No anime yet.</p></div>:
                animeList.filter((a: any)=>a.title.toLowerCase().includes(searchAnime.toLowerCase())).map((anime: any)=>{const eps=episodes.filter((ep: any)=>ep.anime_id == anime.id);const isFeat=featuredIds.includes(anime.id);return(<div key={anime.id} className="rounded-2xl border border-white/5 overflow-hidden" style={{background:'rgba(255,255,255,0.01)'}}><div className="flex items-center gap-4 p-4 border-b border-white/5" style={{background:'rgba(255,255,255,0.02)'}}><div className="w-12 h-16 rounded-lg bg-cover shrink-0" style={{backgroundImage:`url(${anime.image})`}}/><div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><p className="text-sm font-bold text-white">{anime.title}</p><span className="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-400">{anime.type}</span><span className={`px-2 py-0.5 rounded text-[9px] font-bold ${anime.status==='Completed'?'bg-emerald-500/20 text-emerald-400':'bg-blue-500/20 text-blue-400'}`}>{anime.status}</span>{isFeat&&<span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400">★</span>}</div><p className="text-xs text-white/30 mt-0.5">{anime.genre} • ★{anime.score}</p></div><span className="text-xs text-white/20">{eps.length} ep</span><div className="flex gap-1"><button onClick={()=>openEditAnime(anime)} className="p-2 text-white/30 hover:text-blue-400"><Edit className="w-4 h-4"/></button><button onClick={()=>deleteAnime(anime.id)} className="p-2 text-white/30 hover:text-red-400"><Trash2 className="w-4 h-4"/></button></div></div>{eps.length>0&&<div className="p-3"><div className="flex gap-2 flex-wrap">{eps.sort((a: any, b: any)=>a.number-b.number).map((ep: any)=>(<div key={ep.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-white/5" style={{background:'rgba(255,255,255,0.02)'}}><span className="font-bold text-white/70">#{ep.number}</span><span className="text-white/30">{ep.title||'Untitled'}</span>{Object.keys(ep.languages||{}).map((l: any)=><span key={l} className="text-[9px] text-white/20 bg-white/5 px-1 rounded">{l.toUpperCase()}</span>)}<button onClick={()=>deleteEpisode(ep.id)} className="text-white/15 hover:text-red-400"><X className="w-3 h-3"/></button></div>))}</div></div>}</div>)})}
            </div>
          )}

          {/* ==================== REPORTS ==================== */}
          {activeSection === 'reports' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black text-white">Reported Links</h2>
                  <p className="text-white/30 text-xs mt-1">User‑reported broken or slow links from Firestore</p>
                </div>
                <button
                  onClick={loadReports}
                  disabled={reportsLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${reportsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {reportsLoading ? (
                <div className="text-center py-12 text-white/30">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
                  <p className="text-sm">Loading reports...</p>
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12 text-white/20">
                  <Flag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No broken links reported yet.</p>
                  <p className="text-xs mt-1">Users can report links from the video player loading screen.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((report: any) => (
                    <div
                      key={report.id}
                      className="rounded-2xl border border-red-500/10 p-5"
                      style={{ background: 'rgba(239,68,68,0.03)' }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-white">{report.animeTitle}</h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">
                              Ep {report.episodeNumber}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-white/40">Server:</span>{' '}
                              <span className="text-white/70">{report.serverName || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-white/40">Reason:</span>{' '}
                              <span className="text-red-300">{report.reason || 'Loading timeout'}</span>
                            </div>
                            {report.userId && (
                              <div>
                                <span className="text-white/40">User:</span>{' '}
                                <span className="text-white/50 font-mono text-[10px]">{report.userId}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-white/40">Reported:</span>{' '}
                              <span className="text-white/50">
                                {report.createdAt?.toDate?.()
                                  ? new Date(report.createdAt.toDate()).toLocaleString()
                                  : 'Just now'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 p-3 rounded-xl bg-black/30 border border-white/5">
                            <p className="text-[11px] text-white/50 break-all font-mono">{report.url}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => deleteReport(report.id)}
                          className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors shrink-0"
                          title="Mark as resolved"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* ==================== END REPORTS ==================== */}

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
    </div>
  );
}