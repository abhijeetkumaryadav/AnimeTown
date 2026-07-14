"use client";

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Play, Clock, Bell, ChevronRight, Info, CalendarDays, BellRing, Newspaper, TrendingUp, BellOff, ArrowLeft
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import { requestFCMToken, listenForForegroundMessages } from '@/lib/fcm';

// ============================================================
// TYPES
// ============================================================
interface Anime {
  id: number;
  title: string;
  image: string;
  type: string;
  score: number;
  status: string;
}

interface ScheduleItem {
  id: number;
  anime_id: number;
  day: number;
  time: string;
  episode: number;
  title?: string;
}

interface NewsItem {
  id: number;
  title: string;
  content: string;
  image?: string;
  date?: string;
  link?: string;
  status: 'published' | 'draft';
  author?: string;
}

// ============================================================
// CACHE HELPERS (client‑side only)
// ============================================================
const UPDATES_CACHE_KEY = 'updatesCache';
const NOTIFIED_KEY = 'animetown_notified';

function getCachedUpdates() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(UPDATES_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveUpdatesCache(animeList: Anime[], scheduleItems: ScheduleItem[], newsItems: NewsItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(UPDATES_CACHE_KEY, JSON.stringify({
      animeList,
      scheduleItems,
      newsItems,
    }));
  } catch {}
}

// ============================================================
// SKELETON COMPONENTS
// ============================================================
function SkeletonCard() {
  return (
    <div className="bg-[#0b0b10] border border-zinc-900 p-3 rounded-xl flex items-start gap-4 animate-pulse">
      <div className="w-16 h-16 bg-zinc-800 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-zinc-800 rounded w-3/4" />
        <div className="h-3 bg-zinc-800 rounded w-1/2" />
        <div className="h-3 bg-zinc-800 rounded w-1/3" />
      </div>
    </div>
  );
}

function SkeletonSidebarItem() {
  return (
    <div className="flex items-center gap-3 p-2 animate-pulse">
      <div className="w-12 h-16 bg-zinc-800 rounded-lg shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-zinc-800 rounded w-3/4" />
        <div className="h-2 bg-zinc-800 rounded w-1/2" />
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function UpdatesPage({
  navigateTo,
  user,
}: {
  navigateTo?: (page: string, tab?: string, params?: any) => void;
  user?: { id: string } | null;
}) {
  // ---- All states start empty to match server render ----
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);

  // ---- UI states ----
  const [activeDay, setActiveDay] = useState<number>(0);
  const [activeView, setActiveView] = useState<'schedule' | 'latest'>('schedule');
  const [notifiedItems, setNotifiedItems] = useState<Record<number, boolean>>({});
  const [showNotified, setShowNotified] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied'>('default');
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const notificationTimers = useRef<Record<number, NodeJS.Timeout>>({});

  // ---- News detail state ----
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  // ---- Fix hydration mismatches ----
  useEffect(() => {
    setActiveDay(new Date().getDay());
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'latest') setActiveView('latest');
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission as typeof notificationPermission);
    }
    const saved = localStorage.getItem(NOTIFIED_KEY);
    if (saved) {
      try { setNotifiedItems(JSON.parse(saved)); } catch {}
    }

    // Listen for foreground push messages
    listenForForegroundMessages();
  }, []);

  // ---- Instant cache load before paint ----
  useLayoutEffect(() => {
    const cached = getCachedUpdates();
    if (cached) {
      setAnimeList(cached.animeList || []);
      setScheduleItems(cached.scheduleItems || []);
      setNewsItems(cached.newsItems || []);
    }
  }, []);

  // ---- Background data refresh ----
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [animeRes, scheduleRes, newsRes] = await Promise.all([
          fetch('/api/anime').then(r => r.json()),
          fetch('/api/schedule').then(r => r.json()),
          fetch('/api/news').then(r => r.json()),
        ]);
        const freshAnime = animeRes.anime || [];
        const freshSchedule = scheduleRes.schedule || [];
        const allNews = newsRes.news || [];
        const published = allNews.filter((n: NewsItem) => n.status === 'published');

        setAnimeList(freshAnime);
        setScheduleItems(freshSchedule);
        setNewsItems(published);

        saveUpdatesCache(freshAnime, freshSchedule, published);
      } catch (error) {
        console.error('Failed to fetch updates data:', error);
      }
    };
    fetchData();
  }, []);

  // ---- Re‑schedule all active notifications on load and when schedule / notifiedItems change ----
  useEffect(() => {
    // Clear old timers
    Object.values(notificationTimers.current).forEach(timer => clearTimeout(timer));
    notificationTimers.current = {};

    // Schedule timers for every active notification
    Object.keys(notifiedItems).forEach(itemId => {
      const id = parseInt(itemId);
      const item = scheduleItems.find(s => s.id === id);
      if (item) scheduleNotification(item);
    });
  }, [notifiedItems, scheduleItems]);

  // ---- Save notified items to localStorage ----
  useEffect(() => {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notifiedItems));
  }, [notifiedItems]);

  // ---- Improved notification scheduling (respects day of week) ----
  const scheduleNotification = (item: ScheduleItem) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // Cancel any previous timer for this item
    if (notificationTimers.current[item.id]) {
      clearTimeout(notificationTimers.current[item.id]);
      delete notificationTimers.current[item.id];
    }

    const now = new Date();
    const [hours, minutes] = (item.time || '00:00').split(':').map(Number);
    const targetDay = item.day; // 0 = Sunday … 6 = Saturday

    // Find the next occurrence of the target day & time
    const targetDate = new Date(now);
    targetDate.setHours(hours, minutes, 0, 0);

    // Calculate days until the next target day
    let daysUntilTarget = targetDay - now.getDay();
    if (daysUntilTarget < 0) daysUntilTarget += 7; // already passed this week → next week
    if (daysUntilTarget === 0 && targetDate <= now) daysUntilTarget = 7; // today but time already passed

    targetDate.setDate(targetDate.getDate() + daysUntilTarget);

    // Fire 5 minutes before the show
    const notifyTime = new Date(targetDate.getTime() - 5 * 60 * 1000);
    const delay = notifyTime.getTime() - now.getTime();
    if (delay <= 0) return; // already past

    const timer = setTimeout(() => {
      const anime = getAnimeDetails(item.anime_id);
      new Notification(`🔔 ${anime?.title || item.title || 'Anime'} Starting Soon!`, {
        body: `Episode ${item.episode} airs at ${item.time} (in 5 minutes).`,
        icon: anime?.image || '/favicon.ico',
        badge: '/favicon.ico',
        tag: `animetown-${item.id}`,
        requireInteraction: true,
      });
    }, delay);

    notificationTimers.current[item.id] = timer;
  };

  // ---- Handle notification click (service worker) ----
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const handler = (event: Event) => {
        const notification = (event as any).notification;
        if (notification?.data?.url) {
          if (navigateTo) {
            const url = notification.data.url;
            const params = new URLSearchParams(url.split('?')[1]);
            const animeId = params.get('anime');
            const episodeId = params.get('ep');
            if (animeId) navigateTo('watch', undefined, { anime: parseInt(animeId), ep: episodeId || '' });
          } else {
            window.open(notification.data.url, '_blank');
          }
          notification.close();
        }
      };
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('notificationclick', handler);
      }
      return () => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.removeEventListener('notificationclick', handler);
        }
      };
    }
  }, [navigateTo]);

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const getAnimeDetails = (animeId: number) => {
    return animeList.find(a => a.id === animeId) || null;
  };

  const openWatch = (animeId: number, episodeNumber?: number) => {
    if (navigateTo) {
      navigateTo('watch', undefined, { anime: animeId, ep: episodeNumber || '' });
    } else {
      window.location.href = `/watch?anime=${animeId}&ep=${episodeNumber || ''}`;
    }
  };

  // ---- Save FCM token when notification permission granted ----
  const saveFCMTokenToFirestore = async () => {
    console.log('Requesting FCM token...');
    const token = await requestFCMToken();
    console.log('Token received:', token);
    if (token) {
      const userId = user?.id || 'anonymous';
      await setDoc(doc(db, 'fcm_tokens', userId), { token, updatedAt: new Date() }, { merge: true });
      console.log('FCM token saved');
    } else {
      console.log('No token – check VAPID key and service worker.');
    }
  };

  const toggleNotification = (itemId: number) => {
    const item = scheduleItems.find(s => s.id === itemId);
    if (!item) return;

    setNotifiedItems(prev => {
      const updated = { ...prev };
      if (updated[itemId]) {
        delete updated[itemId];
        // timer will be cleared by the useEffect cleanup
      } else {
        if (Notification.permission !== 'granted') {
          setShowPermissionBanner(true);
          return prev;
        }
        updated[itemId] = true;
      }
      return updated;
    });
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support notifications.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission as typeof notificationPermission);
    setShowPermissionBanner(false);
    if (permission === 'granted') {
      // Save FCM token for push notifications
      await saveFCMTokenToFirestore();

      // Immediately schedule all currently active toggled items
      Object.keys(notifiedItems).forEach(id => {
        const item = scheduleItems.find(s => s.id === parseInt(id));
        if (item) scheduleNotification(item);
      });
    }
  };

  // Group schedule items by day
  const itemsByDay: Record<number, ScheduleItem[]> = {};
  scheduleItems.forEach(item => {
    if (!itemsByDay[item.day]) itemsByDay[item.day] = [];
    itemsByDay[item.day].push(item);
  });
  Object.keys(itemsByDay).forEach(day => {
    itemsByDay[Number(day)].sort((a, b) => a.time.localeCompare(b.time));
  });

  const todayItems = itemsByDay[activeDay] || [];
  const allWeekItems = scheduleItems.slice().sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.time.localeCompare(b.time);
  });

  const notifiedList = allWeekItems.filter(item => notifiedItems[item.id]);
  const publishedNews = newsItems.sort((a, b) => {
    return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
  });
  const featuredNews = publishedNews[0] || null;
  const latestNews = publishedNews.slice(1);

  const handleNewsClick = (news: NewsItem) => setSelectedNews(news);
  const handleBackFromNews = () => setSelectedNews(null);

  const showSkeleton = animeList.length === 0 && scheduleItems.length === 0;

  // ---- News Detail View ----
  if (selectedNews) {
    return (
      <div className="min-h-screen bg-[#040406] text-zinc-100 font-sans selection:bg-amber-500 flex flex-col">
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6 pb-24 md:pb-12">
          <button onClick={handleBackFromNews} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-bold">Back to Updates</span>
          </button>
          <div className="bg-[#0d0d14] border border-zinc-900 rounded-2xl overflow-hidden">
            {selectedNews.image && (
              <div className="w-full aspect-video bg-zinc-900 overflow-hidden">
                <img src={selectedNews.image} alt={selectedNews.title} className="w-full h-full object-cover" />
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

  // ---- Main Updates Page ----
  return (
    <div className="min-h-screen bg-[#040406] text-zinc-100 font-sans selection:bg-amber-500 flex flex-col">
      {/* PERMISSION BANNER */}
      {showPermissionBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-black px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 text-xs md:text-sm font-bold">
            <BellRing className="w-4 h-4" />
            Enable notifications to get alerts when anime air!
          </div>
          <div className="flex items-center gap-2">
            <button onClick={requestNotificationPermission} className="bg-black text-amber-400 text-[10px] md:text-xs font-bold px-3 py-1 rounded-lg hover:bg-zinc-900 transition-colors">
              Enable
            </button>
            <button onClick={() => setShowPermissionBanner(false)} className="text-black/70 hover:text-black text-lg">×</button>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-8 pb-24 md:pb-12">

        {/* HEADER TABS */}
        <div className="flex items-center justify-between border-b border-zinc-900/80 pb-2">
          <div className="flex items-center gap-6 text-xs md:text-sm font-black uppercase tracking-wider">
            <button
              onClick={() => setActiveView('schedule')}
              className={`pb-2.5 -mb-2.5 flex items-center gap-1.5 transition-colors ${
                activeView === 'schedule'
                  ? "text-amber-500 border-b-2 border-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <CalendarDays className="w-4 h-4" /> Release Schedule
            </button>
            <button
              onClick={() => setActiveView('latest')}
              className={`pb-2.5 -mb-2.5 flex items-center gap-1.5 transition-colors ${
                activeView === 'latest'
                  ? "text-amber-500 border-b-2 border-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Newspaper className="w-4 h-4" /> Latest News
            </button>
          </div>
          <div className="flex items-center gap-3">
            {notificationPermission === 'denied' && (
              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                <BellOff className="w-3 h-3" /> Notifications blocked
              </span>
            )}
            <span className="text-[10px] md:text-xs text-zinc-500 font-bold hidden sm:inline-block">
              {activeView === 'schedule' ? `${scheduleItems.length} shows` : `${publishedNews.length} articles`}
            </span>
          </div>
        </div>

        {/* SCHEDULE VIEW */}
        {activeView === 'schedule' && (
          <>
            {/* HORIZONTAL DATE CARDS */}
            <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-2 pt-1">
              {DAYS.map((day, idx) => {
                const isToday = idx === new Date().getDay();
                const isSelected = activeDay === idx;
                const dayCount = (itemsByDay[idx] || []).length;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveDay(idx)}
                    className={`flex-1 min-w-[62px] md:min-w-[100px] p-2.5 rounded-xl md:rounded-2xl flex flex-col items-center justify-center border transition-all relative ${
                      isSelected
                        ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/15"
                        : isToday
                          ? "bg-amber-900/20 border-amber-800/40 text-amber-400"
                          : "bg-[#0b0b10] border-zinc-900 text-zinc-400 hover:border-zinc-800"
                    }`}
                  >
                    <span className="text-[8px] md:text-[10px] uppercase font-black tracking-wider block opacity-75">
                      {DAYS_SHORT[idx]}
                    </span>
                    <span className="text-sm md:text-lg font-black mt-0.5">
                      {day.substring(0, 3)}
                    </span>
                    {dayCount > 0 && (
                      <span className={`text-[8px] font-bold mt-1 px-1.5 py-0.5 rounded-full ${
                        isSelected ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {dayCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* TIMELINE LIST */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" /> {DAYS[activeDay]}'s Airing Pipeline
                  </h3>
                  {notifiedList.length > 0 && (
                    <button
                      onClick={() => setShowNotified(!showNotified)}
                      className={`text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                        showNotified ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500 hover:text-amber-400'
                      }`}
                    >
                      <BellRing className="w-3 h-3" />
                      {showNotified ? 'Show All' : `Notified (${notifiedList.length})`}
                    </button>
                  )}
                </div>

                <div className="relative pl-4 border-l border-zinc-900 space-y-4 ml-2">
                  {showSkeleton ? (
                    [1, 2, 3].map(i => <SkeletonCard key={i} />)
                  ) : (showNotified
                    ? todayItems.filter(item => notifiedItems[item.id])
                    : todayItems
                  ).length === 0 ? (
                    <div className="text-center py-10 text-zinc-500 text-sm">
                      {showNotified ? "No notified shows for this day." : "No airings scheduled for this day."}
                    </div>
                  ) : (
                    (showNotified ? todayItems.filter(item => notifiedItems[item.id]) : todayItems).map((item) => {
                      const anime = getAnimeDetails(item.anime_id);
                      const isNotified = !!notifiedItems[item.id];
                      return (
                        <div key={item.id} className="relative group flex items-start gap-4 bg-[#0b0b10] border border-zinc-900 p-3 rounded-xl md:rounded-2xl hover:border-zinc-800/80 transition-all">
                          <div className={`absolute -left-[21px] top-5 w-2.5 h-2.5 rounded-full border-2 bg-[#040406] z-10 ${
                            isNotified ? "border-amber-500 ring-4 ring-amber-500/10 animate-pulse" : "border-zinc-800"
                          }`} />

                          <div className="w-16 md:w-20 shrink-0 pt-1">
                            <p className={`text-[11px] md:text-xs font-black ${isNotified ? "text-amber-400" : "text-zinc-400"}`}>
                              {item.time}
                            </p>
                            <p className="text-[8px] text-zinc-600 font-bold mt-0.5">
                              {item.episode ? `Ep ${item.episode}` : ''}
                            </p>
                          </div>

                          <div
                            className="w-20 md:w-28 aspect-[16/10] rounded-lg overflow-hidden bg-zinc-900 relative shrink-0 cursor-pointer"
                            onClick={() => openWatch(item.anime_id, item.episode)}
                          >
                            <img
                              src={anime?.image || "https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=400&q=80"}
                              alt=""
                              className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-8 h-8 bg-black/50 backdrop-blur-xs rounded-full border border-zinc-800 flex items-center justify-center">
                                <Play className="w-3 h-3 text-white fill-current translate-x-0.5" />
                              </div>
                            </div>
                          </div>

                          <div
                            className="flex-1 min-w-0 pr-10 space-y-1 cursor-pointer"
                            onClick={() => openWatch(item.anime_id, item.episode)}
                          >
                            <h4 className="text-[11px] md:text-sm font-bold text-zinc-200 group-hover:text-amber-400 transition-colors truncate leading-tight">
                              {item.title || anime?.title || 'Unknown'}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 text-[9px] md:text-[10px] font-bold">
                              <span className="text-zinc-400">Episode {item.episode}</span>
                              <span className="text-zinc-600">•</span>
                              <span className="text-amber-500/90 bg-amber-900/20 border border-amber-800/30 px-1.5 py-0.5 rounded text-[8px]">
                                {anime?.type || 'TV Series'}
                              </span>
                              {isNotified && (
                                <span className="text-amber-400 bg-amber-900/30 border border-amber-800/30 px-1.5 py-0.5 rounded text-[8px] flex items-center gap-1">
                                  <BellRing className="w-2 h-2" /> Alert set
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={(e) => { e.stopPropagation(); toggleNotification(item.id); }}
                            className={`absolute right-3 top-4 p-1.5 rounded-lg transition-all ${
                              isNotified
                                ? "text-amber-400 bg-amber-900/20 hover:bg-amber-900/40"
                                : "text-zinc-600 hover:text-amber-400 hover:bg-zinc-900"
                            }`}
                            title={isNotified ? "Remove notification alert" : "Set notification alert"}
                          >
                            {isNotified ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SIDEBAR – Airing This Week */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-zinc-400">Airing This Week</h3>
                  <span className="text-[10px] font-bold text-zinc-500">{allWeekItems.length} shows</span>
                </div>

                <div className="bg-[#0b0b10] border border-zinc-900 rounded-xl p-2 h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                  <div className="space-y-2">
                    {showSkeleton ? (
                      [1, 2, 3].map(i => <SkeletonSidebarItem key={i} />)
                    ) : allWeekItems.length === 0 ? (
                      <div className="text-center py-8 text-zinc-500 text-sm">No shows this week</div>
                    ) : (
                      allWeekItems.map((item) => {
                        const anime = getAnimeDetails(item.anime_id);
                        const isNotified = !!notifiedItems[item.id];
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-900/50 cursor-pointer group transition-all"
                            onClick={() => openWatch(item.anime_id, item.episode)}
                          >
                            <div className="w-12 h-16 rounded-lg overflow-hidden bg-zinc-900 shrink-0">
                              <img
                                src={anime?.image || "https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=100&q=80"}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-zinc-200 truncate group-hover:text-amber-400 transition-colors">
                                {item.title || anime?.title || 'Unknown'}
                              </h4>
                              <div className="flex items-center gap-2 text-[10px] font-bold">
                                <span className="text-zinc-500">{DAYS_SHORT[item.day]} {item.time}</span>
                                <span className="text-zinc-600">•</span>
                                <span className="text-zinc-500">Ep {item.episode}</span>
                                {isNotified && <BellRing className="w-3 h-3 text-amber-500" />}
                              </div>
                            </div>
                            <Play className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="bg-[#0b0b10] border border-zinc-900 p-4 rounded-xl md:rounded-2xl flex items-start gap-3 text-[10px] md:text-xs text-zinc-500 leading-relaxed">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p>
                      Click the <span className="text-zinc-400 font-semibold">Bell icon</span> to receive a browser notification <span className="text-amber-400 font-semibold">5 minutes before</span> the episode airs.
                    </p>
                    {notificationPermission === 'denied' && (
                      <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-2">
                        <p className="text-amber-400 font-bold text-[9px] flex items-center gap-1">
                          <BellOff className="w-2.5 h-2.5" /> Notifications are blocked. Enable them in your browser settings.
                        </p>
                      </div>
                    )}
                    {notifiedList.length > 0 && (
                      <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-2">
                        <p className="text-amber-400 font-bold text-[9px] flex items-center gap-1">
                          <BellRing className="w-2.5 h-2.5" /> {notifiedList.length} alert{notifiedList.length > 1 ? 's' : ''} scheduled
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* LATEST NEWS VIEW */}
        {activeView === 'latest' && (
          <div className="space-y-6">
            {showSkeleton ? (
              <div className="relative w-full rounded-2xl overflow-hidden bg-[#0c0d19] border border-zinc-900/60 min-h-[280px] md:min-h-[360px] flex items-end animate-pulse">
                <div className="absolute inset-0 bg-zinc-800" />
                <div className="relative z-20 p-6 md:p-10 max-w-2xl space-y-3">
                  <div className="h-4 bg-zinc-700 rounded w-24" />
                  <div className="h-8 bg-zinc-700 rounded w-3/4" />
                  <div className="h-4 bg-zinc-700 rounded w-1/2" />
                </div>
              </div>
            ) : (
              featuredNews && (
                <div
                  className="relative w-full rounded-2xl overflow-hidden bg-[#0c0d19] border border-zinc-900/60 min-h-[280px] md:min-h-[360px] flex items-end cursor-pointer group"
                  onClick={() => handleNewsClick(featuredNews)}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-[#040406] via-[#040406]/60 to-transparent z-10" />
                  <div className="absolute inset-0 z-0">
                    <img
                      src={featuredNews.image || "https://images.unsplash.com/photo-1560972550-aba34571a3ba?w=1000&q=80"}
                      alt={featuredNews.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  </div>
                  <div className="relative z-20 p-6 md:p-10 max-w-2xl space-y-3">
                    <span className="inline-flex items-center gap-1 bg-amber-500 text-black text-[9px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase">
                      <TrendingUp className="w-3 h-3" /> Featured News
                    </span>
                    <h2 className="text-xl md:text-3xl font-black text-white leading-tight group-hover:text-amber-400 transition-colors">
                      {featuredNews.title}
                    </h2>
                    <p className="text-xs md:text-sm text-zinc-400 line-clamp-2 leading-relaxed">
                      {featuredNews.content?.substring(0, 200)}...
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                      <span>{featuredNews.date || 'Just now'}</span>
                      {featuredNews.author && <><span>•</span><span>{featuredNews.author}</span></>}
                    </div>
                  </div>
                </div>
              )
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Newspaper className="w-3.5 h-3.5 text-amber-500" /> Latest News
                </h3>
                <span className="text-[10px] font-bold text-zinc-500">{latestNews.length} articles</span>
              </div>

              {showSkeleton ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="bg-[#0b0b10] border border-zinc-900 rounded-xl overflow-hidden animate-pulse">
                      <div className="aspect-video bg-zinc-800" />
                      <div className="p-4 space-y-2">
                        <div className="h-4 bg-zinc-800 rounded w-3/4" />
                        <div className="h-3 bg-zinc-800 rounded w-1/2" />
                        <div className="h-3 bg-zinc-800 rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : latestNews.length === 0 ? (
                <div className="text-center py-16 text-zinc-500">
                  <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No news articles yet</p>
                  <p className="text-xs mt-1">Check back later for updates.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {latestNews.map((news) => (
                    <div
                      key={news.id}
                      className="bg-[#0b0b10] border border-zinc-900 rounded-xl md:rounded-2xl overflow-hidden group hover:border-amber-500/20 transition-all cursor-pointer"
                      onClick={() => handleNewsClick(news)}
                    >
                      {news.image && (
                        <div className="aspect-video bg-zinc-900 relative overflow-hidden">
                          <img
                            src={news.image}
                            alt={news.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-2 left-2 bg-amber-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded uppercase">News</div>
                        </div>
                      )}
                      <div className="p-4 space-y-2">
                        <h4 className="text-xs md:text-sm font-bold text-zinc-200 group-hover:text-amber-400 transition-colors line-clamp-2 leading-snug">{news.title}</h4>
                        <p className="text-[10px] md:text-xs text-zinc-500 line-clamp-2 leading-relaxed">{news.content?.substring(0, 120)}...</p>
                        <div className="flex items-center justify-between text-[9px] text-zinc-600 pt-1 border-t border-zinc-900/50">
                          <span>{news.date || 'Just now'}</span>
                          <span className="text-amber-500 font-bold flex items-center gap-1">Read more <ChevronRight className="w-3 h-3" /></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}