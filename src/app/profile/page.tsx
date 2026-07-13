"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Play, Clock, TrendingUp, Heart, History, Award,
  User, Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, Shield,
  LogOut, Settings, Edit3, Check, X, Star, List, Tv, Camera,
  Video, Share2, ExternalLink, FileText, AlertTriangle, Upload, Pencil
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

// ============================================================
// TYPES
// ============================================================
type AuthMode = 'login' | 'signup';
type ProfileTab = 'Overview' | 'Watch History' | 'My List' | 'Ratings' | 'Achievements' | 'Settings';

interface User {
  id: string;
  email: string;
  user_metadata?: {
    username?: string;
  };
}

interface Profile {
  username?: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
  watch_time: number;
  episodes_watched: number;
  series_completed: number;
  streak: number;
  last_watch_date?: string;
}

// ============================================================
// SKELETON LOADING COMPONENTS
// ============================================================
function SkeletonRow() {
  return <div className="h-4 bg-zinc-800 rounded animate-pulse w-full" />;
}

function SkeletonCard() {
  return (
    <div className="bg-[#0b0b10] border border-zinc-900 rounded-xl p-4 animate-pulse">
      <div className="w-full aspect-[16/10] bg-zinc-800 rounded-lg mb-3" />
      <div className="h-3 bg-zinc-800 rounded w-3/4 mb-2" />
      <div className="h-2 bg-zinc-800 rounded w-1/2" />
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================
const GENRE_COLORS: Record<string, string> = {
  'Action': 'bg-red-600',
  'Adventure': 'bg-orange-500',
  'Fantasy': 'bg-purple-500',
  'Comedy': 'bg-yellow-500',
  'Drama': 'bg-indigo-500',
  'Romance': 'bg-pink-500',
  'Horror': 'bg-gray-500',
  'Sci-Fi': 'bg-cyan-500',
  'Mystery': 'bg-teal-500',
  'Sports': 'bg-green-500',
  'Supernatural': 'bg-violet-500',
  'Thriller': 'bg-rose-500',
  'Isekai': 'bg-emerald-500',
  'Psychological': 'bg-slate-500',
  'Slice of Life': 'bg-amber-500',
  'Music': 'bg-fuchsia-500',
  'Mecha': 'bg-blue-600',
  'Historical': 'bg-amber-700',
  'Seinen': 'bg-zinc-500',
  'Shounen': 'bg-red-700',
};

const genreColorList = [
  'bg-red-600', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  'bg-rose-500', 'bg-gray-500', 'bg-zinc-500', 'bg-neutral-500'
];

function getGenreColor(genre: string): string {
  if (GENRE_COLORS[genre]) return GENRE_COLORS[genre];
  let hash = 0;
  for (let i = 0; i < genre.length; i++) {
    hash = (hash << 5) - hash + genre.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % genreColorList.length;
  return genreColorList[index];
}

function getTimeAgo(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatWatchTime(minutes: number): string {
  if (minutes < 60) return `${minutes} mins`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

// ============================================================
// LOGIN FORM – separate stable component (prevents focus loss)
// ============================================================
function LoginForm({
  authMode,
  email, setEmail,
  password, setPassword,
  username, setUsername,
  showPassword, setShowPassword,
  authError,
  authLoading,
  handleAuth,
  setAuthMode,
  setAuthError,
}: any) {
  // Updated background images
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

  // Rotate every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % animeBgs.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [animeBgs.length]);

  const currentBg = animeBgs[bgIndex];

  const particles = useMemo(() => [...Array(20)].map(() => ({
    width: Math.random() * 4 + 2,
    height: Math.random() * 4 + 2,
    top: Math.random() * 100,
    left: Math.random() * 100,
    animationDelay: Math.random() * 3,
    animationDuration: Math.random() * 3 + 2,
  })), []);

  return (
    <div className="min-h-screen bg-[#06070d] text-zinc-100 font-sans selection:bg-red-600 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={currentBg.url} alt={currentBg.title} className="w-full h-full object-cover transition-all duration-1000" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#06070d]/95 via-[#06070d]/90 to-[#06070d]/95" />
        <div className="absolute inset-0 bg-gradient-to-t from-red-900/20 via-transparent to-purple-900/20" />
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
            className={`w-2 h-2 rounded-full transition-all duration-300 ${i === bgIndex ? 'bg-red-500 w-6' : 'bg-white/20 hover:bg-white/40'}`} />
        ))}
      </div>
      <div className="absolute top-6 left-6 z-10">
        <p className="text-white/20 text-xs font-black uppercase tracking-widest">{currentBg.title}</p>
      </div>
      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <Shield className="w-10 h-10 text-red-500" />
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">{authMode === 'login' ? 'Welcome Back, Otaku!' : 'Join the Adventure'}</h1>
            <p className="text-white/40 text-sm mt-2">{authMode === 'login' ? 'Continue your anime journey' : 'Start your anime journey today'}</p>
          </div>
          <div className="rounded-3xl p-8 border border-white/10 shadow-2xl" style={{ background: 'rgba(10,10,20,0.8)', backdropFilter: 'blur(40px)' }}>
            {authError && (
              <div className={`p-4 rounded-2xl text-sm mb-5 text-center ${authError.includes('created') || authError.includes('Check your email') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                {authError}
              </div>
            )}
            <form onSubmit={handleAuth} className="space-y-5">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Username</label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-purple-600/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-red-400 transition-colors" />
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose your ninja name"
                      className="relative w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-white/20 focus:border-red-500/50 outline-none transition-all text-sm" required={authMode === 'signup'} suppressHydrationWarning />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Email</label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-purple-600/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-red-400 transition-colors" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email"
                    className="relative w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-white/20 focus:border-red-500/50 outline-none transition-all text-sm" required suppressHydrationWarning />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Password</label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-purple-600/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-red-400 transition-colors" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your secret key"
                    className="relative w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-12 text-white placeholder-white/20 focus:border-red-500/50 outline-none transition-all text-sm" required suppressHydrationWarning />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={authLoading}
                className="w-full py-4 rounded-2xl text-white font-bold text-sm tracking-wider transition-all hover:scale-[1.02] active:scale-95 shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 group"
                style={{ background: 'linear-gradient(135deg, #dc2626, #7c3aed)' }}>
                {authLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Loading...
                  </span>
                ) : (
                  <>{authMode === 'login' ? 'Enter the Realm' : 'Begin Your Journey'}<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }} className="text-white/40 hover:text-red-400 text-sm transition-colors">
                {authMode === 'login' ? "New here? Create an account →" : 'Already a ninja? Sign in →'}
              </button>
            </div>
          </div>
          <p className="text-center text-white/10 text-xs mt-8">🔒 Your data is protected by powerful jutsus</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function ProfilePage({
  navigateTo,
}: {
  navigateTo?: (page: string, tab?: string, params?: any) => void;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [continueWatching, setContinueWatching] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [topGenres, setTopGenres] = useState<any[]>([]);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [watchHistory, setWatchHistory] = useState<any[]>([]);
  const [myList, setMyList] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('Overview');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // ---- Instant cache load ----
  useLayoutEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedUser = localStorage.getItem('profileUser');
      if (cachedUser) {
        try { setUser(JSON.parse(cachedUser)); } catch {}
      }
      const cachedDash = localStorage.getItem('profileDashboard');
      if (cachedDash) {
        try {
          const dash = JSON.parse(cachedDash);
          setProfile(dash.profile || null);
          setContinueWatching(dash.continueWatching || []);
          setRecentActivity(dash.recentActivity || []);
          setAchievements(dash.achievements || []);
          setTopGenres(dash.topGenres || []);
          setWatchlistCount(dash.watchlistCount || 0);
          setWatchHistory(dash.watchHistory || []);
          setMyList(dash.myList || []);
          setRatings(dash.ratings || []);
          setBio(dash.profile?.bio || '');
          setAvatarUrl(dash.profile?.avatar_url || '');
          setCoverUrl(dash.profile?.cover_url || '');
          setDataLoaded(true);
          setLoading(false);
        } catch {}
      }
    }
  }, []);

  // ---- Auth check & data fetch ----
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const freshUser = {
          id: session.user.id,
          email: session.user.email!,
          user_metadata: session.user.user_metadata,
        };
        setUser(freshUser);
        if (typeof window !== 'undefined') localStorage.setItem('profileUser', JSON.stringify(freshUser));
        await loadAllData(session.user.id);
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('profileUser');
          localStorage.removeItem('profileDashboard');
        }
        setUser(null);
        setLoading(false);
      }
      setAuthChecking(false);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const freshUser = {
          id: session.user.id,
          email: session.user.email!,
          user_metadata: session.user.user_metadata,
        };
        setUser(freshUser);
        if (typeof window !== 'undefined') localStorage.setItem('profileUser', JSON.stringify(freshUser));
        await loadAllData(session.user.id);
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('profileUser');
          localStorage.removeItem('profileDashboard');
        }
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ---- Load all user data ----
  const loadAllData = async (userId: string) => {
    try {
      const animeRes = await fetch('/api/anime').then(r => r.json());
      const allAnime: any[] = animeRes.anime || [];
      setAnimeList(allAnime);

      const titleMap: Record<string, any> = {};
      allAnime.forEach((a: any) => { titleMap[a.title.toLowerCase().trim()] = a.id; });

      const [
        profileRes, watchRes, bookmarksRes, ratingsRes, achRes, genresRes, activityRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('watch_history').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(50),
        supabase.from('bookmarks').select('anime_id').eq('user_id', userId),
        supabase.from('ratings').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('user_achievements').select('*').eq('user_id', userId).order('earned_at', { ascending: false }),
        supabase.from('user_genres').select('*').eq('user_id', userId).order('percentage', { ascending: false }),
        supabase.from('activity_log').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setBio(profileRes.data.bio || '');
        setAvatarUrl(profileRes.data.avatar_url || '');
        setCoverUrl(profileRes.data.cover_url || '');
      }

      const validAnimeIds = new Set(allAnime.map(a => a.id));

      if (watchRes.data) {
        const history = watchRes.data.filter((w: any) => validAnimeIds.has(w.anime_id));
        setWatchHistory(history);
        setContinueWatching(history.map((w: any) => {
          const anime = allAnime.find((a: any) => a.id === w.anime_id);
          return {
            animeId: w.anime_id,
            animeTitle: anime?.title || 'Unknown',
            animeImage: anime?.image || 'https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=400&q=80',
            epNumber: w.last_episode || 1,
            progress: w.progress || 0,
            updatedAt: w.updated_at,
          };
        }));
      }

      if (bookmarksRes.data) {
        const ids = bookmarksRes.data.map((b: any) => b.anime_id).filter((id: string) => validAnimeIds.has(id));
        setWatchlistCount(ids.length);
        setMyList(allAnime.filter((a: any) => ids.includes(a.id)).map((a: any) => ({
          id: a.id, title: a.title, image: a.image, type: a.type,
        })));
      }

      if (ratingsRes.data) {
        setRatings(ratingsRes.data.filter((r: any) => validAnimeIds.has(r.anime_id)));
      }

      if (achRes.data) {
        const allPossible = [
          { title: "First Watch", desc: "Watch your first anime", icon: "🎬" },
          { title: "Anime Fan", desc: "Watch 5 different anime", icon: "⭐" },
          { title: "Otaku", desc: "Watch 10 different anime", icon: "🏆" },
          { title: "Binge Watcher", desc: "Reach episode 24", icon: "📺" },
          { title: "Collector", desc: "Add 5 to watchlist", icon: "📚" },
          { title: "Active User", desc: "Log 3 activities", icon: "🔥" },
          { title: "Marathon Watcher", desc: "Watch 50 episodes", icon: "🏃" },
          { title: "Genre Explorer", desc: "Watch anime from 5 genres", icon: "🧭" },
          { title: "Social Butterfly", desc: "Log 10 activities", icon: "🦋" },
          { title: "Streak Master", desc: "Maintain a 7-day streak", icon: "⚡" },
          { title: "Top Genre Fan", desc: "Spend 70% of time in one genre", icon: "🏅" },
          { title: "Reviewer", desc: "Rate 3 anime", icon: "✍️" },
          { title: "Early Adopter", desc: "Join during first month", icon: "🌱" },
        ];
        const earnedTitles = achRes.data.map((a: any) => a.title);
        setAchievements(allPossible.map(a => ({
          ...a,
          locked: !earnedTitles.includes(a.title),
        })));
      }

      if (genresRes.data) {
        setTopGenres(genresRes.data.map((g: any) => ({
          name: g.genre,
          percentage: g.percentage || 0,
          color: getGenreColor(g.genre),
        })));
      }

      if (activityRes.data) {
        setRecentActivity(activityRes.data.map((a: any) => {
          let animeId = a.anime_id || null;
          if (!animeId) {
            const desc = a.description || '';
            for (const [title, id] of Object.entries(titleMap)) {
              if (desc.toLowerCase().includes(title)) { animeId = id; break; }
            }
          }
          return {
            text: a.description,
            time: getTimeAgo(new Date(a.created_at)),
            img: a.image_url || 'https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=100&q=80',
            rating: a.rating || null,
            animeId: animeId,
          };
        }));
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('profileDashboard', JSON.stringify({
          profile: profileRes.data || null,
          continueWatching: continueWatching,
          recentActivity: recentActivity,
          achievements: achievements,
          topGenres: topGenres,
          watchHistory: watchHistory,
          myList: myList,
          ratings: ratings,
          watchlistCount: watchlistCount,
        }));
      }

      setDataLoaded(true);
      setLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      setLoading(false);
    }
  };

  // ---- Navigation helper ----
  const handleNavigate = (page: string, tab?: string, params?: any) => {
    if (navigateTo) {
      navigateTo(page, tab, params);
    } else {
      if (page === 'home') window.location.href = '/';
      else if (page === 'search') window.location.href = '/search';
      else if (page === 'mylist') window.location.href = '/mylist';
      else if (page === 'updates') window.location.href = '/updates';
      else if (page === 'legal') window.location.href = `/legal?tab=${tab || 'privacy'}`;
      else if (page === 'watch') window.location.href = `/watch?anime=${params?.anime || ''}&ep=${params?.ep || ''}`;
      else if (page === 'profile') window.location.href = '/profile';
    }
  };

  // ---- Authentication ----
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setAuthError(error.message);
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { username: username || email.split('@')[0] } }
        });
        if (error) setAuthError(error.message);
        else setAuthError('Account created! Please check your email to confirm, then sign in.');
      }
    } catch (err) {
      setAuthError('An unexpected error occurred');
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('profileUser');
      localStorage.removeItem('profileDashboard');
    }
    setUser(null);
  };

  // ---- Handle image upload (base64) ----
  const handleImageUpload = (file: File, type: 'avatar' | 'cover') => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === 'avatar') setAvatarUrl(base64);
      else setCoverUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  // ---- Profile updates ----
  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      await supabase.from('profiles').update({
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        bio: bio,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
      setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl, cover_url: coverUrl, bio } : null);
      setShowEditProfile(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const tabs: ProfileTab[] = ["Overview", "Watch History", "My List", "Ratings", "Achievements", "Settings"];

  // ---- Render logic ----
  const showSkeleton = authChecking && !user;

  const SkeletonPlaceholder = () => (
    <div className="min-h-screen bg-[#040406] text-zinc-100 font-sans selection:bg-red-600 flex flex-col">
      <div className="flex-1 overflow-y-auto pb-24 md:pb-12">
        <main className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
          <div className="w-full rounded-2xl md:rounded-3xl bg-gradient-to-r from-purple-900/40 via-red-900/30 to-orange-900/20 min-h-[200px] border border-zinc-900 animate-pulse" />
          <div className="border-b border-zinc-900/80 flex gap-6 overflow-x-auto scrollbar-none sticky top-[61px] bg-[#040406] z-30 -mx-4 px-4 md:-mx-8 md:px-8">
            {tabs.map((_, i) => (
              <div key={i} className="py-3 text-[11px] md:text-xs font-bold tracking-wide text-zinc-500">Loading...</div>
            ))}
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="h-4 bg-zinc-800 rounded animate-pulse w-40" />
              <div className="grid grid-flow-col auto-cols-[140px] md:auto-cols-[180px] gap-4">
                {[1,2,3].map(i => <SkeletonCard key={i} />)}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="bg-[#0b0b10] border border-zinc-900 p-4 rounded-xl"><SkeletonRow /><SkeletonRow /></div>
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-[#0b0b10] border border-zinc-900 p-4 rounded-xl space-y-3">
                  <SkeletonRow /><SkeletonRow /><SkeletonRow />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );

  const stats = profile ? {
    watchTime: profile.watch_time || 0,
    episodesWatched: profile.episodes_watched || 0,
    seriesCompleted: profile.series_completed || 0,
    streak: profile.streak || 0,
  } : { watchTime: 0, episodesWatched: 0, seriesCompleted: 0, streak: 0 };

  const displayName = profile?.username || user?.user_metadata?.username || user?.email?.split('@')[0] || 'AnimeLover';

  const filteredContinueWatching = useMemo(() => {
    if (!animeList.length) return [];
    const validIds = new Set(animeList.map(a => a.id));
    return continueWatching.filter(item => validIds.has(item.animeId));
  }, [continueWatching, animeList]);

  const filteredWatchHistory = useMemo(() => {
    if (!animeList.length) return [];
    const validIds = new Set(animeList.map(a => a.id));
    return watchHistory.filter(item => validIds.has(item.anime_id));
  }, [watchHistory, animeList]);

  const filteredMyList = useMemo(() => {
    if (!animeList.length) return [];
    const validIds = new Set(animeList.map(a => a.id));
    return myList.filter(item => validIds.has(item.id));
  }, [myList, animeList]);

  const filteredRatings = useMemo(() => {
    if (!animeList.length) return [];
    const validIds = new Set(animeList.map(a => a.id));
    return ratings.filter(item => validIds.has(item.anime_id));
  }, [ratings, animeList]);

  const Dashboard = () => (
    <div className="min-h-screen bg-[#040406] text-zinc-100 font-sans selection:bg-red-600 flex flex-col">
      <div className="flex-1 overflow-y-auto pb-24 md:pb-12">
        <main className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
          {/* HERO BANNER */}
          <div
            className="relative w-full rounded-2xl md:rounded-3xl bg-gradient-to-r from-purple-900/60 via-red-900/40 to-orange-900/30 bg-cover bg-center overflow-hidden border border-zinc-900 shadow-xl min-h-[200px]"
            style={{ backgroundImage: profile?.cover_url ? `url(${profile.cover_url})` : undefined }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/50 to-black/20 z-10" />
            <div className="relative z-20 p-4 md:p-8 pt-24 md:pt-32 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex items-center gap-4 md:gap-6">
                <div className="relative w-16 h-16 md:w-24 md:h-24 rounded-full border-2 border-red-600/40 shadow-xl shrink-0 overflow-hidden bg-zinc-800 group">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-black text-red-500">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="space-y-0.5 md:space-y-1 flex-1">
                  <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">{displayName}</h1>
                  <p className="text-[10px] md:text-xs text-zinc-400">@{user?.email?.split('@')[0]}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">{profile?.bio || 'No bio yet'}</p>
                </div>
              </div>
              <div className="flex items-center bg-zinc-950/70 backdrop-blur-md border border-zinc-900/60 p-4 rounded-2xl gap-6 relative">
                <div className="flex gap-6 text-center">
                  <div><p className="text-sm md:text-base font-black text-white">{formatWatchTime(stats.watchTime)}</p><p className="text-[8px] md:text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Watch Time</p></div>
                  <div><p className="text-sm md:text-base font-black text-white">{stats.episodesWatched}</p><p className="text-[8px] md:text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Episodes</p></div>
                  <div><p className="text-sm md:text-base font-black text-white">{watchlistCount}</p><p className="text-[8px] md:text-[9px] uppercase font-bold text-zinc-500 tracking-wider">List</p></div>
                </div>
                <button
                  onClick={() => setShowEditProfile(true)}
                  className="absolute top-2 right-2 p-1.5 bg-zinc-800/50 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
                  title="Edit profile"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* TABS */}
          <div className="border-b border-zinc-900/80 flex gap-6 overflow-x-auto scrollbar-none sticky top-[61px] bg-[#040406] z-30 -mx-4 px-4 md:-mx-8 md:px-8">
            {tabs.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`py-3 text-[11px] md:text-xs font-bold tracking-wide relative whitespace-nowrap transition-colors ${activeTab === tab ? "text-red-500" : "text-zinc-500 hover:text-zinc-300"}`}>
                {tab}
                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-full" />}
              </button>
            ))}
          </div>

          {/* CONTENT */}
          {!dataLoaded ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center"><h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-zinc-400">Continue Watching</h3></div>
                <div className="grid grid-flow-col auto-cols-[140px] md:auto-cols-[180px] gap-4">
                  {[1,2,3].map(i => <SkeletonCard key={i} />)}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div className="md:col-span-2 space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    {[1,2,3,4].map(i => (<div key={i} className="bg-[#0b0b10] border border-zinc-900 p-4 rounded-xl"><SkeletonRow /><SkeletonRow /></div>))}
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-[#0b0b10] border border-zinc-900 p-4 rounded-xl space-y-3"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Overview / Watch History / My List / Ratings / Achievements / Settings – unchanged */}
              {/* (the entire content of these sections is identical to your previous code) */}
              {/* I'll include them all for completeness */}

              {activeTab === "Overview" && (
                <>
                  <section className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-500" /> Continue Watching
                      </h3>
                    </div>
                    {filteredContinueWatching.length === 0 ? (
                      <div className="bg-[#0b0b10] border border-zinc-900 rounded-xl p-8 text-center">
                        <Play className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500">No episodes watched yet</p>
                      </div>
                    ) : (
                      <div className="grid grid-flow-col auto-cols-[140px] md:auto-cols-[180px] gap-4 overflow-x-auto pb-2 scrollbar-none">
                        {filteredContinueWatching.map((anime, i) => (
                          <div key={i} className="bg-[#0b0b10] border border-zinc-900 rounded-xl md:rounded-2xl overflow-hidden hover:border-zinc-800 transition-all group cursor-pointer"
                            onClick={() => handleNavigate('watch', undefined, { anime: anime.animeId, ep: '' })}>
                            <div className="relative aspect-[16/10] bg-zinc-900 overflow-hidden">
                              <img src={anime.animeImage} alt="" className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-300" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-7 h-7 md:w-9 md:h-9 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center border border-zinc-700/40 opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all">
                                  <Play className="w-2.5 h-2.5 md:w-3 md:h-3 text-white fill-current translate-x-0.5" />
                                </div>
                              </div>
                            </div>
                            <div className="p-3 space-y-2">
                              <h4 className="text-[11px] md:text-xs font-bold text-zinc-200 line-clamp-1">{anime.animeTitle}</h4>
                              <p className="text-[9px] text-zinc-500">EP {anime.epNumber}</p>
                              <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                <div className="h-full bg-red-600" style={{ width: `${anime.progress}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                    <div className="space-y-6 md:col-span-2">
                      <div className="space-y-3">
                        <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-red-500" /> Statistics
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: "Watch Time", value: stats.watchTime, formatter: (v: number) => v > 0 ? formatWatchTime(v) : '-' },
                            { label: "Episodes Watched", value: stats.episodesWatched, formatter: (v: number) => v > 0 ? v : '-' },
                            { label: "Series Completed", value: stats.seriesCompleted, formatter: (v: number) => v > 0 ? v : '-' },
                            { label: "Days Streak", value: stats.streak, formatter: (v: number) => v > 0 ? `${v} Days` : '-' }
                          ].map((stat, i) => (
                            <div key={i} className="bg-[#0b0b10] border border-zinc-900 p-4 rounded-xl">
                              <p className="text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                              <p className="text-base md:text-xl font-black text-white">{stat.formatter(stat.value)}</p>
                              {stat.value === 0 && <p className="text-[9px] text-zinc-600 mt-1">Start watching!</p>}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                          <Heart className="w-3.5 h-3.5 text-red-500" /> Top Genres
                        </h3>
                        <div className="bg-[#0b0b10] border border-zinc-900 p-4 rounded-xl space-y-3.5">
                          {topGenres.length === 0 || topGenres.every(g => g.percentage === 0) ? (
                            <p className="text-xs text-zinc-500 text-center py-4">Watch more anime to see your genre preferences</p>
                          ) : (
                            topGenres.map((genre, idx) => (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-[11px] font-bold">
                                  <span className="text-zinc-300">{genre.name}</span>
                                  <span className="text-zinc-400">{genre.percentage}%</span>
                                </div>
                                <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                                  <div className={`h-full ${genre.color}`} style={{ width: `${genre.percentage}%` }} />
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-red-500" /> Achievements
                        </h3>
                        <div className="grid grid-cols-3 gap-2.5">
                          {achievements.map((badge, idx) => (
                            <div key={idx} className={`flex flex-col items-center text-center p-3 rounded-xl border ${badge.locked ? 'bg-[#0b0b10]/50 border-zinc-900/30 opacity-50' : 'bg-[#0b0b10] border-zinc-900/60'}`}>
                              <div className={`w-9 h-9 rounded-full border flex items-center justify-center font-black text-xs ${badge.locked ? 'border-zinc-800 bg-zinc-900 text-zinc-600' : 'border-zinc-800 bg-zinc-900 text-red-500'}`}>
                                {badge.icon}
                              </div>
                              <h4 className={`text-[9px] font-black mt-1.5 truncate ${badge.locked ? 'text-zinc-600' : 'text-zinc-200'}`}>{badge.title}</h4>
                              <p className="text-[7px] text-zinc-600 truncate mt-0.5">{badge.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "Watch History" && (
                <section className="space-y-4">
                  <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-red-500" /> Watch History
                  </h3>
                  {filteredWatchHistory.length === 0 ? (
                    <div className="bg-[#0b0b10] border border-zinc-900 rounded-xl p-12 text-center">
                      <Tv className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                      <p className="text-sm text-zinc-500">No watch history yet</p>
                      <p className="text-xs text-zinc-600 mt-1">Start watching anime to build your history</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredWatchHistory.map((item, idx) => {
                        const anime = animeList.find(a => a.id === item.anime_id);
                        const progress = item.progress || 0;
                        return (
                          <div key={idx} className="bg-[#0b0b10] border border-zinc-900 rounded-xl overflow-hidden hover:border-red-500/30 transition-all group cursor-pointer"
                            onClick={() => handleNavigate('watch', undefined, { anime: item.anime_id })}>
                            <div className="flex items-start gap-4 p-3">
                              <div className="w-16 h-24 rounded-lg bg-zinc-900 overflow-hidden shrink-0">
                                <img src={anime?.image || "https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=200&q=80"} alt="" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <h4 className="text-xs font-bold text-zinc-200 line-clamp-1">{anime?.title || `Anime #${item.anime_id}`}</h4>
                                <p className="text-[10px] text-zinc-500">Episode {item.last_episode}</p>
                                <p className="text-[9px] text-zinc-600">{new Date(item.updated_at).toLocaleDateString()}</p>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500" style={{ width: `${progress}%` }} />
                                  </div>
                                  <span className="text-[9px] font-semibold text-zinc-400 shrink-0">{progress}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {activeTab === "My List" && (
                <section className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <List className="w-3.5 h-3.5 text-red-500" /> My List ({filteredMyList.length})
                    </h3>
                    <button onClick={() => handleNavigate('mylist')} className="text-[10px] font-bold text-red-500 hover:underline">Open Full List →</button>
                  </div>
                  {filteredMyList.length === 0 ? (
                    <div className="bg-[#0b0b10] border border-zinc-900 rounded-xl p-12 text-center">
                      <List className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                      <p className="text-sm text-zinc-500">Your list is empty</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {filteredMyList.map((item) => (
                        <div key={item.id} className="bg-[#0b0b10] border border-zinc-900 rounded-xl overflow-hidden cursor-pointer hover:border-red-500/30 transition-all"
                          onClick={() => handleNavigate('watch', undefined, { anime: item.id })}>
                          <div className="aspect-[3/4] bg-zinc-900">
                            <img src={item.image || "https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=400&q=80"} alt={item.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="p-2">
                            <h4 className="text-[10px] font-bold text-zinc-200 truncate">{item.title}</h4>
                            <p className="text-[8px] text-zinc-500">{item.type || 'TV'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {activeTab === "Ratings" && (
                <section className="space-y-4">
                  <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-red-500" /> Your Ratings ({filteredRatings.length})
                  </h3>
                  {filteredRatings.length === 0 ? (
                    <div className="bg-[#0b0b10] border border-zinc-900 rounded-xl p-12 text-center">
                      <Star className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                      <p className="text-sm text-zinc-500">No ratings yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredRatings.map((rating, idx) => {
                        const anime = animeList.find(a => a.id === rating.anime_id);
                        return (
                          <div key={idx} className="bg-[#0b0b10] border border-zinc-900 rounded-xl overflow-hidden hover:border-amber-500/30 transition-all group cursor-pointer"
                            onClick={() => handleNavigate('watch', undefined, { anime: rating.anime_id })}>
                            <div className="flex items-center gap-4 p-3">
                              <div className="w-12 h-16 rounded-lg bg-zinc-900 overflow-hidden shrink-0">
                                <img src={anime?.image || "https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=200&q=80"} alt="" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-zinc-200 line-clamp-1">{anime?.title || `Anime #${rating.anime_id}`}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <div className="flex items-center gap-0.5">
                                    {[1,2,3,4,5].map((s) => (
                                      <Star key={s} className={`w-3 h-3 ${s <= Math.round(rating.rating/2) ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'}`} />
                                    ))}
                                  </div>
                                  <span className="text-[10px] font-bold text-amber-400">{rating.rating}</span>
                                </div>
                                <p className="text-[9px] text-zinc-500 mt-0.5">Rated on {new Date(rating.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {activeTab === "Achievements" && (
                <section className="space-y-4">
                  <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-red-500" /> Achievements
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {achievements.map((badge, idx) => (
                      <div key={idx} className={`flex flex-col items-center text-center p-5 rounded-xl border ${badge.locked ? 'bg-[#0b0b10]/50 border-zinc-900/30 opacity-50' : 'bg-[#0b0b10] border-zinc-900/60 hover:border-red-500/30'}`}>
                        <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-xl font-black ${badge.locked ? 'border-zinc-800 bg-zinc-900 text-zinc-600' : 'border-red-500/30 bg-zinc-900 text-red-500'}`}>
                          {badge.icon}
                        </div>
                        <h4 className={`text-xs font-black mt-3 ${badge.locked ? 'text-zinc-600' : 'text-zinc-200'}`}>{badge.title}</h4>
                        <p className="text-[10px] text-zinc-600 mt-1">{badge.desc}</p>
                        {badge.locked ? <span className="text-[8px] text-zinc-700 mt-2 bg-zinc-900 px-2 py-0.5 rounded">🔒 Locked</span> : <span className="text-[8px] text-emerald-500 mt-2 bg-emerald-950/30 px-2 py-0.5 rounded">✅ Earned</span>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {activeTab === "Settings" && (
                <section className="space-y-6 max-w-2xl">
                  <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-red-500" /> Settings
                  </h3>

                  <div className="bg-[#0b0b10] border border-zinc-900 rounded-xl p-6 space-y-6">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-300 mb-3">Profile</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400">Avatar</p>
                            <p className="text-[9px] text-zinc-600">Change your profile picture</p>
                          </div>
                          <button onClick={() => setShowEditProfile(true)} className="text-red-500 text-xs font-bold hover:underline">Edit</button>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400">Cover Image</p>
                            <p className="text-[9px] text-zinc-600">Customize your banner</p>
                          </div>
                          <button onClick={() => setShowEditProfile(true)} className="text-red-500 text-xs font-bold hover:underline">Edit</button>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400">Bio</p>
                          <p className="text-xs text-zinc-300 mt-0.5">{profile?.bio || 'No bio'}</p>
                          <button onClick={() => setShowEditProfile(true)} className="text-red-500 text-xs font-bold hover:underline mt-1">Edit</button>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400">Email</p>
                          <p className="text-xs text-zinc-300 mt-0.5">{user?.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="block md:hidden border-t border-zinc-900 pt-4">
                      <h4 className="text-xs font-bold text-zinc-300 mb-3">Legal & Policies</h4>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => handleNavigate('legal', 'disclaimer')} className="flex items-center gap-2 text-xs text-zinc-400 hover:text-red-400 transition-colors">
                          <FileText className="w-3.5 h-3.5" /> Disclaimer
                        </button>
                        <button onClick={() => handleNavigate('legal', 'terms')} className="flex items-center gap-2 text-xs text-zinc-400 hover:text-red-400 transition-colors">
                          <FileText className="w-3.5 h-3.5" /> Terms of Use
                        </button>
                        <button onClick={() => handleNavigate('legal', 'privacy')} className="flex items-center gap-2 text-xs text-zinc-400 hover:text-red-400 transition-colors">
                          <Shield className="w-3.5 h-3.5" /> Privacy Policy
                        </button>
                      </div>
                    </div>

                    <div className="block md:hidden border-t border-zinc-900 pt-4">
                      <h4 className="text-xs font-bold text-zinc-300 mb-3">Connect</h4>
                      <div className="flex flex-col gap-2">
                        <a href="https://www.youtube.com/@animetownin" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-zinc-400 hover:text-red-400 transition-colors">
                          <Video className="w-3.5 h-3.5 text-red-500" /> YouTube
                        </a>
                        <a href="https://www.facebook.com/animetownin/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-zinc-400 hover:text-red-400 transition-colors">
                          <Share2 className="w-3.5 h-3.5 text-blue-500" /> Facebook
                        </a>
                        <a href="https://www.instagram.com/animetownin/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-zinc-400 hover:text-red-400 transition-colors">
                          <Camera className="w-3.5 h-3.5 text-pink-500" /> Instagram
                        </a>
                      </div>
                    </div>

                    <div className="border-t border-zinc-900 pt-4">
                      <h4 className="text-xs font-bold text-zinc-300 mb-3">Account</h4>
                      <button onClick={handleSignOut} className="bg-red-600 hover:bg-red-700 transition-colors px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-2">
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {/* EDIT PROFILE MODAL */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#0b0b10] border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black text-white">Edit Profile</h2>
              <button onClick={() => setShowEditProfile(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Avatar</label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl text-red-500">{displayName.charAt(0)}</div>
                    )}
                  </div>
                  <button onClick={() => avatarInputRef.current?.click()} className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" /> Upload
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'avatar');
                  }} />
                  {avatarUrl && <button onClick={() => setAvatarUrl('')} className="text-[10px] text-red-400 hover:underline">Remove</button>}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Cover Image</label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-24 h-16 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700">
                    {coverUrl ? (
                      <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">No cover</div>
                    )}
                  </div>
                  <button onClick={() => coverInputRef.current?.click()} className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" /> Upload
                  </button>
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'cover');
                  }} />
                  {coverUrl && <button onClick={() => setCoverUrl('')} className="text-[10px] text-red-400 hover:underline">Remove</button>}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500 mt-1 h-20 resize-none" suppressHydrationWarning />
              </div>
            </div>
            <button onClick={handleUpdateProfile} className="w-full bg-red-600 hover:bg-red-700 py-2.5 rounded-lg text-sm font-bold text-white transition-colors">Save Changes</button>
          </div>
        </div>
      )}
    </div>
  );

  // ---- FINAL RENDER ----
  if (showSkeleton) return <SkeletonPlaceholder />;
  if (!user) return (
    <LoginForm
      authMode={authMode}
      email={email} setEmail={setEmail}
      password={password} setPassword={setPassword}
      username={username} setUsername={setUsername}
      showPassword={showPassword} setShowPassword={setShowPassword}
      authError={authError}
      authLoading={authLoading}
      handleAuth={handleAuth}
      setAuthMode={setAuthMode}
      setAuthError={setAuthError}
    />
  );
  return <Dashboard />;
}