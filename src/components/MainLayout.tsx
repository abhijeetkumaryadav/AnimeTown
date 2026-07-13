"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Tv, Search, Compass, Bookmark, CalendarDays, User,
  ChevronDown, Video, Share2, Camera, LogIn, LogOut, Home, Loader2
} from 'lucide-react';
import { useApp } from "@/lib/AppContext";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, selectedLanguage, setSelectedLanguage, loading } = useApp(); // ← added loading

  const getInitialView = () => {
    if (pathname === "/" || pathname === "/home") return "home";
    if (pathname.startsWith("/search")) return "search";
    if (pathname.startsWith("/mylist")) return "mylist";
    if (pathname.startsWith("/updates")) return "updates";
    if (pathname.startsWith("/legal")) return "legal";
    if (pathname.startsWith("/profile")) return "profile";
    if (pathname.startsWith("/watch")) return "watch";
    if (pathname.startsWith("/admin")) return "admin";
    return "home";
  };

  const [currentView, setCurrentView] = useState(getInitialView);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [languages, setLanguages] = useState<any[]>([]);
  const [langLoaded, setLangLoaded] = useState(false);
  const languagesCacheKey = 'animetown_languages_cache';

  // ---- Update currentView on route change ----
  useEffect(() => {
    if (pathname === "/" || pathname === "/home") setCurrentView("home");
    else if (pathname.startsWith("/search")) setCurrentView("search");
    else if (pathname.startsWith("/mylist")) setCurrentView("mylist");
    else if (pathname.startsWith("/updates")) setCurrentView("updates");
    else if (pathname.startsWith("/legal")) setCurrentView("legal");
    else if (pathname.startsWith("/profile")) setCurrentView("profile");
    else if (pathname.startsWith("/watch")) setCurrentView("watch");
    else if (pathname.startsWith("/admin")) setCurrentView("admin");
  }, [pathname]);

  // ---- REMOVED: language sync from localStorage (context already handles it) ----
  // ---- Only save when it changes ----
  useEffect(() => {
    if (selectedLanguage) {
      localStorage.setItem('animetown_lang', selectedLanguage);
    }
  }, [selectedLanguage]);

  // ---- Instant languages cache (before paint) ----
  useLayoutEffect(() => {
    try {
      const cached = localStorage.getItem(languagesCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setLanguages(parsed);
        setLangLoaded(true);
      }
    } catch {}
  }, []);

  // ---- Fetch languages from API ----
  useEffect(() => {
    const fetchLanguages = () => {
      fetch('/api/languages')
        .then(r => r.json())
        .then(data => {
          if (data.languages) {
            const activeLanguages = data.languages.filter(
              (lang: any) => !lang.removed && lang.flag !== '🚫' && lang.type !== 'REMOVED'
            );
            setLanguages(activeLanguages);
            localStorage.setItem(languagesCacheKey, JSON.stringify(activeLanguages));
          }
          setLangLoaded(true);
        })
        .catch(() => setLangLoaded(true));
    };

    fetchLanguages();

    const interval = setInterval(fetchLanguages, 5 * 60 * 1000);
    const onFocus = () => fetchLanguages();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // ---- Navigation ----
  const handleNavigate = (page: string, tab?: string, params?: any) => {
    setActiveDropdown(null);
    if (page === 'watch' && params?.anime) {
      const url = params.ep 
        ? `/watch?anime=${params.anime}&ep=${params.ep}` 
        : `/watch?anime=${params.anime}`;
      router.push(url);
      return;
    }
    const url = tab ? `/${page}?tab=${tab}` : `/${page === "home" ? "" : page}`;
    router.push(url || "/");
  };

  const handleSignOut = async () => {
    const { supabase } = await import('@/lib/supabaseClient');
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleLanguageChange = (code: string) => {
    setSelectedLanguage(code);
    localStorage.setItem('animetown_lang', code);
  };

  const toggleDropdown = (menu: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveDropdown(activeDropdown === menu ? null : menu);
  };

  // ---- Footer visibility ----
  const shouldHideFooterMobile = () => {
    return pathname.startsWith("/search") ||
           pathname.startsWith("/mylist") ||
           pathname.startsWith("/updates") ||
           pathname.startsWith("/profile");
  };

  const isAdminPage = pathname.startsWith("/admin");

  const shouldShowLanguage = () => {
    if (pathname === "/" || pathname === "/home") return true;
    if (pathname.startsWith("/search")) return true;
    if (pathname.startsWith("/watch")) return true;
    return false;
  };

  // ---- Language list with "All" ----
  const allLanguages = langLoaded ? [
    { code: 'all', name: 'All', flag: '🌐', type: 'ALL' },
    ...languages
  ] : [];

  // ------------------------------
  // DESKTOP HEADER
  // ------------------------------
  const DesktopHeader = () => (
    <header className="hidden md:block sticky top-0 z-50 bg-[#07070a]/95 backdrop-blur-md border-b border-zinc-900/80">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleNavigate('home')}>
          <div className="w-6 h-6 bg-red-600 rounded-lg flex items-center justify-center shadow-md shadow-red-600/20">
            <Tv className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-black text-lg tracking-tight text-white">
            Anime<span className="text-red-600">Town</span>
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex items-center gap-8 text-[13px] font-medium text-zinc-400">
          <button onClick={() => handleNavigate('home')} className={`relative flex items-center gap-1 transition-all duration-200 ${currentView === 'home' ? 'text-red-500 font-semibold drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'hover:text-red-400 hover:drop-shadow-[0_0_6px_rgba(239,68,68,0.3)]'}`}>
            Home{currentView === 'home' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.8)]"></span>}
          </button>
          <button onClick={() => handleNavigate('search')} className={`relative flex items-center gap-1 transition-all duration-200 ${currentView === 'search' ? 'text-red-500 font-semibold drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'hover:text-red-400 hover:drop-shadow-[0_0_6px_rgba(239,68,68,0.3)]'}`}>
            Search{currentView === 'search' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.8)]"></span>}
          </button>
          <button onClick={() => handleNavigate('mylist')} className={`relative flex items-center gap-1 transition-all duration-200 ${currentView === 'mylist' ? 'text-red-500 font-semibold drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'hover:text-red-400 hover:drop-shadow-[0_0_6px_rgba(239,68,68,0.3)]'}`}>
            My List{currentView === 'mylist' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.8)]"></span>}
          </button>
          <button onClick={() => handleNavigate('updates')} className={`relative flex items-center gap-1 transition-all duration-200 ${currentView === 'updates' ? 'text-red-500 font-semibold drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'hover:text-red-400 hover:drop-shadow-[0_0_6px_rgba(239,68,68,0.3)]'}`}>
            Updates{currentView === 'updates' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.8)]"></span>}
          </button>

          {/* Connect Dropdown */}
          <div className="relative">
            <button onClick={(e) => toggleDropdown('connect', e)} className={`relative flex items-center gap-1 transition-all duration-200 ${activeDropdown === 'connect' ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'hover:text-red-400 hover:drop-shadow-[0_0_6px_rgba(239,68,68,0.3)]'}`}>
              Connect <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'connect' ? 'rotate-180' : ''}`} />
              {activeDropdown === 'connect' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.8)]"></span>}
            </button>
            {activeDropdown === 'connect' && (
              <div className="absolute left-0 mt-2.5 w-40 bg-[#0b0c14] border border-zinc-800 rounded-lg p-1.5 shadow-xl flex flex-col gap-0.5 z-50">
                <a href="https://www.youtube.com/@animetownin" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-900/60 px-2.5 py-2 rounded-md transition-all duration-200 text-xs"><Video className="w-3.5 h-3.5 text-red-500" /> YouTube</a>
                <a href="https://www.facebook.com/animetownin/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-900/60 px-2.5 py-2 rounded-md transition-all duration-200 text-xs"><Share2 className="w-3.5 h-3.5 text-blue-500" /> Facebook</a>
                <a href="https://www.instagram.com/animetownin/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-900/60 px-2.5 py-2 rounded-md transition-all duration-200 text-xs"><Camera className="w-3.5 h-3.5 text-pink-500" /> Instagram</a>
              </div>
            )}
          </div>

          {/* Legal Dropdown */}
          <div className="relative">
            <button onClick={(e) => toggleDropdown('legal', e)} className={`relative flex items-center gap-1 transition-all duration-200 ${activeDropdown === 'legal' || currentView === 'legal' ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'hover:text-red-400 hover:drop-shadow-[0_0_6px_rgba(239,68,68,0.3)]'}`}>
              Legal <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'legal' ? 'rotate-180' : ''}`} />
              {(activeDropdown === 'legal' || currentView === 'legal') && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.8)]"></span>}
            </button>
            {activeDropdown === 'legal' && (
              <div className="absolute left-0 mt-2.5 w-44 bg-[#0b0c14] border border-zinc-800 rounded-lg p-1.5 shadow-xl flex flex-col gap-0.5 z-50">
                <button onClick={() => handleNavigate('legal', 'disclaimer')} className="text-left text-zinc-400 hover:text-red-400 hover:bg-zinc-900/60 px-2.5 py-2 rounded-md transition-all duration-200 text-xs w-full">Disclaimer</button>
                <button onClick={() => handleNavigate('legal', 'terms')} className="text-left text-zinc-400 hover:text-red-400 hover:bg-zinc-900/60 px-2.5 py-2 rounded-md transition-all duration-200 text-xs w-full">Terms of Use</button>
                <button onClick={() => handleNavigate('legal', 'privacy')} className="text-left text-zinc-400 hover:text-red-400 hover:bg-zinc-900/60 px-2.5 py-2 rounded-md transition-all duration-200 text-xs w-full">Privacy Policy</button>
              </div>
            )}
          </div>
        </nav>

        {/* Right – Languages + Auth */}
        <div className="flex items-center gap-4">
          {/* Language buttons container */}
          <div className={`flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-[240px] ${shouldShowLanguage() ? '' : 'invisible'}`}>
            {langLoaded ? (
              allLanguages.map((lang) => {
                const isActive = selectedLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors duration-200 ${
                      isActive
                        ? 'bg-red-600 text-white shadow-[0_0_6px_rgba(239,68,68,0.4)]'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-400'
                    }`}
                  >
                    <span>{lang.flag}</span> <span>{lang.name}</span>
                  </button>
                );
              })
            ) : (
              <span className="text-zinc-500 text-[10px]">Loading…</span>
            )}
          </div>

          {/* Auth button – no flicker now! */}
          {loading ? (
            // While loading, show a small spinner or nothing
            <div className="w-20 h-8 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            </div>
          ) : !user ? (
            <button onClick={() => handleNavigate('profile')} className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-1.5 rounded-md flex items-center gap-1.5 shadow-lg shadow-red-600/20 hover:shadow-red-600/40 transition-all duration-200">
              <LogIn className="w-3.5 h-3.5" /> Login
            </button>
          ) : (
            <button onClick={() => handleNavigate('profile')} className="flex items-center gap-2 bg-[#0c0d19] border border-zinc-800 px-3 py-1.5 rounded-lg hover:border-red-500/50 transition-all duration-200 text-xs text-zinc-300 font-medium hover:shadow-[0_0_10px_rgba(239,68,68,0.15)]">
              <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                {user.email?.charAt(0).toUpperCase() || 'A'}
              </div>
              <span>My Profile</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );

  // ------------------------------
  // MOBILE HEADER
  // ------------------------------
  const MobileHeader = () => (
    <header className="block md:hidden bg-[#07070a] px-4 pt-4 pb-2 flex justify-between items-center border-b border-zinc-900/60">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleNavigate('home')}>
        <div className="w-6 h-6 bg-red-600 rounded-lg flex items-center justify-center shadow-md shadow-red-600/20">
          <Tv className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-black text-base tracking-tight text-white">Anime<span className="text-red-500">Town</span></span>
      </div>
      {/* Language buttons container */}
      <div className={`flex items-center gap-2 overflow-x-auto scrollbar-none max-w-[200px] ${shouldShowLanguage() ? '' : 'invisible'}`}>
        {langLoaded ? (
          allLanguages.map((lang) => {
            const isActive = selectedLanguage === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold whitespace-nowrap transition-colors duration-200 ${
                  isActive
                    ? 'bg-red-600 text-white shadow-[0_0_6px_rgba(239,68,68,0.4)]'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-400'
                }`}
              >
                <span>{lang.flag}</span> <span>{lang.name}</span>
              </button>
            );
          })
        ) : (
          <span className="text-zinc-500 text-[9px]">Loading…</span>
        )}
      </div>
    </header>
  );

  // ------------------------------
  // MOBILE BOTTOM NAV
  // ------------------------------
  const MobileBottomNav = () => (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0b0c14]/95 backdrop-blur-xl border-t border-zinc-800/60 px-2 py-1.5 flex justify-around items-center z-50">
      <button onClick={() => handleNavigate('home')} className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 ${currentView === 'home' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
        <Home className={`w-5 h-5 ${currentView === 'home' ? 'fill-red-500/20' : ''}`} />
        <span className={`text-[9px] font-medium ${currentView === 'home' ? 'text-red-500' : 'text-zinc-500'}`}>Home</span>
      </button>
      <button onClick={() => handleNavigate('search')} className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 ${currentView === 'search' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
        <Search className="w-5 h-5" />
        <span className={`text-[9px] font-medium ${currentView === 'search' ? 'text-red-500' : 'text-zinc-500'}`}>Search</span>
      </button>
      <button onClick={() => handleNavigate('mylist')} className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 ${currentView === 'mylist' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
        <Bookmark className={`w-5 h-5 ${currentView === 'mylist' ? 'fill-red-500/20' : ''}`} />
        <span className={`text-[9px] font-medium ${currentView === 'mylist' ? 'text-red-500' : 'text-zinc-500'}`}>My List</span>
      </button>
      <button onClick={() => handleNavigate('updates')} className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 ${currentView === 'updates' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
        <CalendarDays className="w-5 h-5" />
        <span className={`text-[9px] font-medium ${currentView === 'updates' ? 'text-red-500' : 'text-zinc-500'}`}>Updates</span>
      </button>
      <button onClick={() => handleNavigate('profile')} className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 ${currentView === 'profile' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
        <User className={`w-5 h-5 ${currentView === 'profile' ? 'fill-red-500/20' : ''}`} />
        <span className={`text-[9px] font-medium ${currentView === 'profile' ? 'text-red-500' : 'text-zinc-500'}`}>Profile</span>
      </button>
    </nav>
  );

  // ------------------------------
  // FOOTER
  // ------------------------------
  const Footer = () => {
    if (shouldHideFooterMobile()) return null;
    return (
      <footer className="w-full bg-[#030408] border-t border-zinc-900/40 py-6 mb-16 md:mb-0 text-center text-xs tracking-wide text-zinc-500/80">
        <div className="max-w-[1400px] mx-auto px-6 space-y-1.5">
          <p>© 2026 AnimeTown. All rights reserved.</p>
          <p className="text-[11px] text-zinc-600/90 max-w-2xl mx-auto">
            This site does not store any files on its server. All contents are provided by non‑affiliated third parties.
          </p>
        </div>
      </footer>
    );
  };

  // ------------------------------
  // MAIN RENDER
  // ------------------------------
  return (
    <div className="min-h-screen bg-[#07070a] text-white flex flex-col">
      {!isAdminPage && <DesktopHeader />}
      {!isAdminPage && <MobileHeader />}
      <main className="flex-1">{children}</main>
      {!isAdminPage && <MobileBottomNav />}
      {!isAdminPage && <Footer />}
    </div>
  );
}