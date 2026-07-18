"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Tv, Search, House, Bookmark, Clock, User, Compass,
  ChevronDown, Video, Share2, Camera, LogIn, LogOut, Home, Loader2, Film, ListOrdered
} from 'lucide-react';
import { useApp } from "@/lib/AppContext";
import { CloudflareAPI } from "@/lib/db-client"; // ✅ Cloudflare client

// ----- LANGUAGE DISPLAY NAMES -----
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

interface Language {
  code: string;
  name: string;
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, selectedLanguage, setSelectedLanguage, loading } = useApp();

  const desktopLangRef = useRef<HTMLDivElement>(null);
  const mobileLangRef = useRef<HTMLDivElement>(null);
  const desktopScrollPos = useRef(0);
  const mobileScrollPos = useRef(0);

  const getInitialView = (): string => {
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

  const [currentView, setCurrentView] = useState<string>(getInitialView);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [langLoaded, setLangLoaded] = useState(false);
  const languagesCacheKey = 'animetown_languages_cache';

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

  useEffect(() => {
    if (selectedLanguage) {
      localStorage.setItem('animetown_lang', selectedLanguage);
    }
  }, [selectedLanguage]);

  useEffect(() => {
    if (desktopLangRef.current) {
      desktopScrollPos.current = desktopLangRef.current.scrollLeft;
    }
    if (mobileLangRef.current) {
      mobileScrollPos.current = mobileLangRef.current.scrollLeft;
    }
  }, [selectedLanguage]);

  useLayoutEffect(() => {
    if (desktopLangRef.current) {
      desktopLangRef.current.scrollLeft = desktopScrollPos.current;
    }
    if (mobileLangRef.current) {
      mobileLangRef.current.scrollLeft = mobileScrollPos.current;
    }
  });

  useEffect(() => {
    const handleDesktopScroll = () => {
      if (desktopLangRef.current) {
        desktopScrollPos.current = desktopLangRef.current.scrollLeft;
      }
    };
    const handleMobileScroll = () => {
      if (mobileLangRef.current) {
        mobileScrollPos.current = mobileLangRef.current.scrollLeft;
      }
    };

    const desktop = desktopLangRef.current;
    const mobile = mobileLangRef.current;

    if (desktop) {
      desktop.addEventListener('scroll', handleDesktopScroll, { passive: true });
    }
    if (mobile) {
      mobile.addEventListener('scroll', handleMobileScroll, { passive: true });
    }

    return () => {
      if (desktop) {
        desktop.removeEventListener('scroll', handleDesktopScroll);
      }
      if (mobile) {
        mobile.removeEventListener('scroll', handleMobileScroll);
      }
    };
  }, []);

  useLayoutEffect(() => {
    try {
      const cached = localStorage.getItem(languagesCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as Language[];
        setLanguages(parsed);
        setLangLoaded(true);
      }
    } catch {
      // ignore cache errors
    }
  }, []);

  // ---- Fetch languages from Cloudflare D1 ----
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const data = await CloudflareAPI.getEpisodes();
        const episodes = data.episodes || [];
        const langSet = new Set<string>();
        episodes.forEach((ep: any) => {
          if (ep.languages) {
            Object.keys(ep.languages).forEach((code) => {
              if (LANGUAGE_DISPLAY_NAMES[code]) {
                langSet.add(code);
              }
            });
          }
        });
        const mapped: Language[] = Array.from(langSet)
          .map((code) => ({
            code: code,
            name: LANGUAGE_DISPLAY_NAMES[code],
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setLanguages(mapped);
        localStorage.setItem(languagesCacheKey, JSON.stringify(mapped));
      } catch (error) {
        console.error('Failed to fetch languages from Cloudflare:', error);
      } finally {
        setLangLoaded(true);
      }
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
    if (desktopLangRef.current) {
      desktopScrollPos.current = desktopLangRef.current.scrollLeft;
    }
    if (mobileLangRef.current) {
      mobileScrollPos.current = mobileLangRef.current.scrollLeft;
    }
    setSelectedLanguage(code);
    localStorage.setItem('animetown_lang', code);
  };

  const toggleDropdown = (menu: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveDropdown(activeDropdown === menu ? null : menu);
  };

  const shouldHideFooterMobile = (): boolean => {
    return pathname.startsWith("/search") ||
           pathname.startsWith("/mylist") ||
           pathname.startsWith("/updates") ||
           pathname.startsWith("/profile");
  };

  const isAdminPage = pathname.startsWith("/admin");

  // 🔥 SHOW LANGUAGE ON SEARCH TOO
  const shouldShowLanguage = (): boolean => {
    if (pathname === "/" || pathname === "/home") return true;
    if (pathname.startsWith("/watch")) return true;
    if (pathname.startsWith("/search")) return true; // added
    return false;
  };

  // 🔥 SHOW MOBILE HEADER ON SEARCH TOO
  const shouldShowMobileHeader = (): boolean => {
    return pathname === "/" || 
           pathname === "/home" || 
           pathname.startsWith("/watch") || 
           pathname.startsWith("/search");
  };

  const isHomePage = pathname === "/" || pathname === "/home";

  const allLanguages: Language[] = langLoaded
    ? [
        { code: 'all', name: 'All' },
        ...languages,
      ]
    : [];

  // ------------------------------
  // DESKTOP HEADER
  // ------------------------------
  const DesktopHeader = () => (
    <header className="hidden md:block sticky top-0 z-50 bg-black/30 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleNavigate('home')}>
          <div className="w-6 h-6 bg-red-700 rounded-lg flex items-center justify-center shadow-md shadow-red-700/20">
            <Tv className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-black text-lg tracking-tight text-white">
            Anime<span className="text-red-500">Town</span>
          </span>
        </div>

        <nav className="flex items-center gap-8 text-[13px] font-medium text-zinc-400">
          <button onClick={() => handleNavigate('home')} className={`relative flex items-center gap-1 transition-all duration-200 ${currentView === 'home' ? 'text-amber-500 font-semibold drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'hover:text-amber-400 hover:drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]'}`}>
            Home{currentView === 'home' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full shadow-[0_0_6px_rgba(245,158,11,0.8)]"></span>}
          </button>
          <button onClick={() => handleNavigate('search')} className={`relative flex items-center gap-1 transition-all duration-200 ${currentView === 'search' ? 'text-amber-500 font-semibold drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'hover:text-amber-400 hover:drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]'}`}>
            Search{currentView === 'search' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full shadow-[0_0_6px_rgba(245,158,11,0.8)]"></span>}
          </button>
          <button onClick={() => handleNavigate('mylist')} className={`relative flex items-center gap-1 transition-all duration-200 ${currentView === 'mylist' ? 'text-amber-500 font-semibold drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'hover:text-amber-400 hover:drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]'}`}>
            My List{currentView === 'mylist' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full shadow-[0_0_6px_rgba(245,158,11,0.8)]"></span>}
          </button>
          <button onClick={() => handleNavigate('updates')} className={`relative flex items-center gap-1 transition-all duration-200 ${currentView === 'updates' ? 'text-amber-500 font-semibold drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'hover:text-amber-400 hover:drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]'}`}>
            Updates{currentView === 'updates' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full shadow-[0_0_6px_rgba(245,158,11,0.8)]"></span>}
          </button>

          <div className="relative">
            <button onClick={(e) => toggleDropdown('connect', e)} className={`relative flex items-center gap-1 transition-all duration-200 ${activeDropdown === 'connect' ? 'text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'hover:text-amber-400 hover:drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]'}`}>
              Connect <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'connect' ? 'rotate-180' : ''}`} />
              {activeDropdown === 'connect' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full shadow-[0_0_6px_rgba(245,158,11,0.8)]"></span>}
            </button>
            {activeDropdown === 'connect' && (
              <div className="absolute left-0 mt-2.5 w-40 bg-[#0b0c14] border border-zinc-800 rounded-lg p-1.5 shadow-xl flex flex-col gap-0.5 z-50">
                <a href="https://www.youtube.com/@animetownin" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-900/60 px-2.5 py-2 rounded-md transition-all duration-200 text-xs"><Video className="w-3.5 h-3.5 text-amber-500" /> YouTube</a>
                <a href="https://www.facebook.com/animetownin/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-900/60 px-2.5 py-2 rounded-md transition-all duration-200 text-xs"><Share2 className="w-3.5 h-3.5 text-blue-500" /> Facebook</a>
                <a href="https://www.instagram.com/animetownin/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-900/60 px-2.5 py-2 rounded-md transition-all duration-200 text-xs"><Camera className="w-3.5 h-3.5 text-pink-500" /> Instagram</a>
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={(e) => toggleDropdown('legal', e)} className={`relative flex items-center gap-1 transition-all duration-200 ${activeDropdown === 'legal' || currentView === 'legal' ? 'text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'hover:text-amber-400 hover:drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]'}`}>
              Legal <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'legal' ? 'rotate-180' : ''}`} />
              {(activeDropdown === 'legal' || currentView === 'legal') && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full shadow-[0_0_6px_rgba(245,158,11,0.8)]"></span>}
            </button>
            {activeDropdown === 'legal' && (
              <div className="absolute left-0 mt-2.5 w-44 bg-[#0b0c14] border border-zinc-800 rounded-lg p-1.5 shadow-xl flex flex-col gap-0.5 z-50">
                <button onClick={() => handleNavigate('legal', 'disclaimer')} className="text-left text-zinc-400 hover:text-amber-400 hover:bg-zinc-900/60 px-2.5 py-2 rounded-md transition-all duration-200 text-xs w-full">Disclaimer</button>
                <button onClick={() => handleNavigate('legal', 'terms')} className="text-left text-zinc-400 hover:text-amber-400 hover:bg-zinc-900/60 px-2.5 py-2 rounded-md transition-all duration-200 text-xs w-full">Terms of Use</button>
                <button onClick={() => handleNavigate('legal', 'privacy')} className="text-left text-zinc-400 hover:text-amber-400 hover:bg-zinc-900/60 px-2.5 py-2 rounded-md transition-all duration-200 text-xs w-full">Privacy Policy</button>
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-4">
          <div
            ref={desktopLangRef}
            className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-[240px]"
          >
            {langLoaded ? (
              allLanguages.map((lang) => {
                const isActive = selectedLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    data-lang-code={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors duration-200 ${
                      isActive
                        ? 'bg-amber-500 text-black shadow-[0_0_6px_rgba(245,158,11,0.4)]'
                        : 'bg-zinc-900/80 border border-zinc-700/80 text-zinc-400 hover:text-amber-400'
                    }`}
                  >
                    {lang.name}
                  </button>
                );
              })
            ) : (
              <span className="text-zinc-500 text-[10px]">Loading…</span>
            )}
          </div>

          {loading ? (
            <div className="w-20 h-8 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            </div>
          ) : !user ? (
            <button onClick={() => handleNavigate('profile')} className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-semibold px-4 py-1.5 rounded-md flex items-center gap-1.5 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all duration-200">
              <LogIn className="w-3.5 h-3.5" /> Login
            </button>
          ) : (
            <button onClick={() => handleNavigate('profile')} className="flex items-center gap-2 bg-[#0c0d19]/80 backdrop-blur-md border border-zinc-700/80 px-3 py-1.5 rounded-lg hover:border-amber-500/50 transition-all duration-200 text-xs text-zinc-300 font-medium hover:shadow-[0_0_10px_rgba(245,158,11,0.15)]">
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
  const MobileHeader = () => {
    if (!shouldShowMobileHeader()) return null;

    const headerContent = (
      <>
        <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => handleNavigate('home')}>
          <div className="w-6 h-6 bg-red-700 rounded-lg flex items-center justify-center shadow-md shadow-red-700/20">
            <Tv className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-black text-base tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
            Anime<span className="text-red-500">Town</span>
          </span>
        </div>

        {shouldShowLanguage() && (
          <div
            ref={mobileLangRef}
            className="flex items-center gap-2 overflow-x-auto scrollbar-none max-w-[160px]"
          >
            {langLoaded ? (
              allLanguages.map((lang) => {
                const isActive = selectedLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    data-lang-code={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold whitespace-nowrap transition-colors duration-200 ${
                      isActive
                        ? 'bg-amber-500 text-black shadow-[0_0_6px_rgba(245,158,11,0.4)]'
                        : 'bg-black/30 backdrop-blur-sm border border-white/10 text-white/80 hover:text-amber-400'
                    }`}
                  >
                    {lang.name}
                  </button>
                );
              })
            ) : (
              <span className="text-white/60 text-[9px] drop-shadow">Loading…</span>
            )}
          </div>
        )}
      </>
    );

    if (isHomePage) {
      return (
        <header className="md:hidden absolute top-0 left-0 right-0 z-20 bg-transparent px-4 py-2 pointer-events-none">
          <div className="pointer-events-auto flex items-center justify-between gap-3">
            {headerContent}
          </div>
        </header>
      );
    }

    return (
      <header className="block md:hidden bg-transparent px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          {headerContent}
        </div>
      </header>
    );
  };

  // ------------------------------
  // MOBILE BOTTOM NAV
  // ------------------------------
  const MobileBottomNav = () => (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none px-3 pb-3">
      <div className="pointer-events-auto flex items-center justify-around bg-black/20 backdrop-blur-lg border border-white/10 rounded-full h-12 px-1.5">
        <button
          onClick={() => handleNavigate('home')}
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${
            currentView === 'home'
              ? 'text-amber-400'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Tv className="w-5 h-5" strokeWidth={1.8} />
          <span className="text-[9px] font-medium">Home</span>
        </button>
        <button
          onClick={() => handleNavigate('search')}
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${
            currentView === 'search'
              ? 'text-amber-400'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Search className="w-5 h-5" strokeWidth={1.8} />
          <span className="text-[9px] font-medium">Search</span>
        </button>
        <button
          onClick={() => handleNavigate('mylist')}
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${
            currentView === 'mylist'
              ? 'text-amber-400'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ListOrdered className="w-5 h-5" strokeWidth={1.8} />
          <span className="text-[9px] font-medium">My List</span>
        </button>
        <button
          onClick={() => handleNavigate('updates')}
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${
            currentView === 'updates'
              ? 'text-amber-400'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Clock className="w-5 h-5" strokeWidth={1.8} />
          <span className="text-[9px] font-medium">Updates</span>
        </button>
        <button
          onClick={() => handleNavigate('profile')}
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${
            currentView === 'profile'
              ? 'text-amber-400'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <User className="w-5 h-5" strokeWidth={1.8} />
          <span className="text-[9px] font-medium">Profile</span>
        </button>
      </div>
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
    <div className="relative min-h-screen bg-[#07070a] text-white flex flex-col">
      {!isAdminPage && <DesktopHeader />}
      {!isAdminPage && <MobileHeader />}
      <main className="flex-1">{children}</main>
      {!isAdminPage && <MobileBottomNav />}
      {!isAdminPage && <Footer />}
    </div>
  );
}