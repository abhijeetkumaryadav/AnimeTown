// lib/videoSources.ts

import { supabase } from './supabaseClient';

// ------------------------------------------------------------------
//  Types & Interfaces
// ------------------------------------------------------------------

export type VideoSourceType = 
  | 'iframe'
  | 'direct'
  | 'hls'
  | 'embed'
  | 'google_drive'
  | 'ok_ru'
  | 'custom';

export interface VideoSource {
  id: string;
  type: VideoSourceType;
  url: string;
  name: string;
  priority: number;
  headers?: Record<string, string>;
  embedOptions?: {
    allowFullscreen?: boolean;
    allowAutoplay?: boolean;
    hideControls?: string[];
  };
  active: boolean;
  lastChecked?: number;
}

// ------------------------------------------------------------------
//  Embed Extractor  (stripped)
// ------------------------------------------------------------------

export interface EmbedInfo {
  type: 'iframe' | 'direct' | 'hls';
  url: string;
  error?: string;
}

export class EmbedExtractor {
  /**
   * Attempt to find the actual embed URL from a page URL.
   * Only the kept sites (Nxsha) have specific extraction logic;
   * everything else falls back to a generic iframe attempt.
   */
  static async extractVideoUrl(pageUrl: string): Promise<EmbedInfo> {
    try {
      // Nxsha – keep
      if (pageUrl.includes('nxsha.app')) {
        const match = pageUrl.match(/\/watch\/tv\/(\d+)\/(\d+)\/(\d+)/);
        if (match) {
          const [, showId, season, episode] = match;
          return {
            type: 'iframe',
            url: `https://web.nxsha.app/embed/tv/${showId}/${season}/${episode}`
          };
        }
      }

      // Fallback – treat as iframe
      return {
        type: 'iframe',
        url: pageUrl
      };
    } catch (error: any) {
      return {
        type: 'iframe',
        url: pageUrl,
        error: error.message
      };
    }
  }

  /**
   * Returns an array of possible embed URLs to try.
   */
  static getPossibleEmbeds(url: string): string[] {
    const possibilities: string[] = [url];

    // Nxsha patterns
    if (url.includes('nxsha.app')) {
      const match = url.match(/\/watch\/tv\/(\d+)\/(\d+)\/(\d+)/);
      if (match) {
        const [, showId, season, episode] = match;
        possibilities.push(
          `https://web.nxsha.app/embed/tv/${showId}/${season}/${episode}`,
          `https://nxsha.app/embed/tv/${showId}/${season}/${episode}`
        );
      }
    }

    return possibilities;
  }
}

// ------------------------------------------------------------------
//  Embed Detector  (stripped)
// ------------------------------------------------------------------

export interface EmbedResult {
  success: boolean;
  url: string;
  type: 'iframe' | 'direct' | 'hls' | 'proxy';
  error?: string;
  headers?: Record<string, string>;
}

export class EmbedDetector {
  // Only kept sites remain in the pattern map.
  private static patterns: Record<string, (url: string) => string | null> = {
    // Vidnest
    'vidnest.fun': (url: string) => {
      const match = url.match(/anime\/(\d+)\/(\d+)\/(\w+)/);
      if (match) {
        const [, id, ep, lang] = match;
        return `https://vidnest.fun/anime/${id}/${ep}/${lang}`;
      }
      const paheMatch = url.match(/animepahe\/(\d+)\/(\d+)\/(\w+)/);
      if (paheMatch) {
        const [, id, ep, lang] = paheMatch;
        return `https://vidnest.fun/animepahe/${id}/${ep}/${lang}`;
      }
      return null;
    },

    // Nxsha
    'nxsha.app': (url: string) => {
      const match = url.match(/\/watch\/tv\/(\d+)\/(\d+)\/(\d+)/);
      if (match) {
        const [, showId, season, episode] = match;
        return `https://web.nxsha.app/embed/tv/${showId}/${season}/${episode}`;
      }
      const embedMatch = url.match(/\/embed\/tv\/(\d+)\/(\d+)\/(\d+)/);
      if (embedMatch) {
        const [, showId, season, episode] = embedMatch;
        return `https://web.nxsha.app/embed/tv/${showId}/${season}/${episode}`;
      }
      return null;
    },

    // OK.ru
    'ok.ru': (url: string) => {
      const match = url.match(/\/video\/(\d+)/);
      if (match) {
        const [, videoId] = match;
        return `https://ok.ru/videoembed/${videoId}`;
      }
      return null;
    },

    // Vimeo
    'vimeo.com': (url: string) => {
      const match = url.match(/\/\/(\d+)/);
      if (match) {
        const [, videoId] = match;
        return `https://player.vimeo.com/video/${videoId}`;
      }
      return null;
    }
  };

  /**
   * Try to detect an embeddable URL for the given page/URL.
   */
  static detectEmbed(url: string): EmbedResult {
    const urlLower = url.toLowerCase();

    // Check kept patterns
    for (const [domain, handler] of Object.entries(this.patterns)) {
      if (urlLower.includes(domain)) {
        const embedUrl = handler(url);
        if (embedUrl) {
          return {
            success: true,
            url: embedUrl,
            type: this.detectType(embedUrl)
          };
        }
      }
    }

    // Already an embed URL
    if (url.includes('/embed/') || url.includes('embed?')) {
      return {
        success: true,
        url: url,
        type: 'iframe'
      };
    }

    // Fallback to proxy
    return {
      success: true,
      url: `/api/proxy?url=${encodeURIComponent(url)}`,
      type: 'proxy'
    };
  }

  private static detectType(url: string): 'iframe' | 'direct' | 'hls' | 'proxy' {
    if (url.includes('.mp4') || url.includes('.webm')) return 'direct';
    if (url.includes('.m3u8')) return 'hls';
    if (url.includes('/proxy')) return 'proxy';
    return 'iframe';
  }

  /**
   * Generate a list of URL variations that might work.
   */
  static tryVariations(url: string): string[] {
    const results: string[] = [url];

    // Common transformations
    if (url.includes('/watch/')) {
      results.push(url.replace('/watch/', '/embed/'));
      results.push(url.replace('/watch/', '/player/'));
    }
    if (url.includes('episode')) {
      results.push(url.replace('episode', 'embed'));
      results.push(url.replace('episode', 'player'));
    }

    // Proxy version
    results.push(`/api/proxy?url=${encodeURIComponent(url)}`);

    return results;
  }
}

// ------------------------------------------------------------------
//  Video Source Manager  (stripped parseUrl)
// ------------------------------------------------------------------

export class VideoSourceManager {
  private sources: Map<string, VideoSource[]> = new Map();
  private globalSources: VideoSource[] = [];
  private sourceCache: Map<string, { source: VideoSource; timestamp: number }> = new Map();
  private CACHE_DURATION = 60000;

  constructor() {
    this.loadSources();
    setTimeout(() => this.loadFromSupabase(), 1000);
  }

  private loadSources() {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('videoSources');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.entries(parsed).forEach(([key, value]) => {
          if (key === 'global') {
            this.globalSources = value as VideoSource[];
          } else if (key.startsWith('anime_')) {
            const animeId = key.replace('anime_', '');
            this.sources.set(animeId, value as VideoSource[]);
          }
        });
        console.log('✅ Loaded video sources from cache');
      }
    } catch (e) {
      console.log('No cached sources found');
      this.initializeDefaultSources();
    }
  }

  private saveSources() {
    if (typeof window === 'undefined') return;
    try {
      const data: Record<string, any> = {
        global: this.globalSources
      };
      this.sources.forEach((value, key) => {
        data[`anime_${key}`] = value;
      });
      localStorage.setItem('videoSources', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save sources:', e);
    }
  }

  private initializeDefaultSources() {
    this.globalSources = [
      {
        id: 'test_video',
        type: 'direct',
        url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
        name: 'Test Video (MP4)',
        priority: 999,
        active: true
      }
    ];
    this.saveSources();
  }

  /**
   * Parse a user-supplied URL and decide its type.
   * Removed: screenscape, youtube, 2dhive, 4animo, animefreak,
   *          kickassanime, animotvslash, miruro, google_drive.
   */
  parseUrl(url: string): { type: VideoSourceType; parsedUrl: string; metadata?: any } {
    const trimmed = url.trim();

    // 1. Vidnest
    if (trimmed.includes('vidnest.fun')) {
      return {
        type: 'iframe',
        parsedUrl: trimmed,
        metadata: { platform: 'vidnest' }
      };
    }

    // 2. Nxsha
    if (trimmed.includes('nxsha.app') || trimmed.includes('web.nxsha.app')) {
      return {
        type: 'iframe',
        parsedUrl: trimmed,
        metadata: { platform: 'nxsha' }
      };
    }

    // 3. OK.ru
    if (trimmed.includes('ok.ru/video')) {
      return {
        type: 'ok_ru',
        parsedUrl: trimmed,
        metadata: { platform: 'ok_ru' }
      };
    }

    // 4. Vimeo
    const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return {
        type: 'iframe',
        parsedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`,
        metadata: { videoId: vimeoMatch[1], platform: 'vimeo' }
      };
    }

    // 5. Direct video files
    if (/\.(mp4|webm|m3u8|ogg|mkv)(\?|$)/i.test(trimmed)) {
      return {
        type: 'direct',
        parsedUrl: trimmed,
        metadata: { format: 'direct' }
      };
    }

    // 6. HLS streams
    if (trimmed.includes('.m3u8') || trimmed.includes('m3u8')) {
      return {
        type: 'hls',
        parsedUrl: trimmed,
        metadata: { format: 'hls' }
      };
    }

    // 7. Any other HTTP URL – try as iframe
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return {
        type: 'iframe',
        parsedUrl: trimmed,
        metadata: { platform: 'unknown', note: 'Attempting to embed as iframe' }
      };
    }

    // 8. Fallback
    return {
      type: 'embed',
      parsedUrl: trimmed,
      metadata: { platform: 'unknown' }
    };
  }

  createSourceFromUrl(url: string, name?: string): VideoSource {
    const parsed = this.parseUrl(url);
    return {
      id: `custom_${Date.now()}`,
      type: parsed.type,
      url: parsed.parsedUrl,
      name: name || `Custom Source (${parsed.type.toUpperCase()})`,
      priority: 999,
      active: true,
      embedOptions: {
        allowFullscreen: true,
        allowAutoplay: true
      }
    };
  }

  getSourcesForAnime(animeId: string): VideoSource[] {
    const cached = this.sourceCache.get(animeId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return this.sourceCache.get(animeId)?.source ? [this.sourceCache.get(animeId)!.source] : [];
    }

    const animeSources = this.sources.get(animeId) || [];
    const sorted = [...this.globalSources, ...animeSources]
      .filter(s => s.active)
      .sort((a, b) => a.priority - b.priority);

    if (sorted.length > 0) {
      this.sourceCache.set(animeId, {
        source: sorted[0],
        timestamp: Date.now()
      });
    }

    return sorted;
  }

  addSource(animeId: string | null, source: VideoSource | string): void {
    let sourceObj: VideoSource;

    if (typeof source === 'string') {
      sourceObj = this.createSourceFromUrl(source);
    } else {
      sourceObj = source;
    }

    if (animeId) {
      const existing = this.sources.get(animeId) || [];
      existing.push(sourceObj);
      this.sources.set(animeId, existing);
    } else {
      this.globalSources.push(sourceObj);
    }

    this.saveSources();
    if (animeId) {
      this.sourceCache.delete(animeId);
    }
    this.syncToSupabase();
  }

  removeSource(animeId: string | null, sourceId: string): void {
    if (animeId) {
      const sources = this.sources.get(animeId) || [];
      this.sources.set(animeId, sources.filter(s => s.id !== sourceId));
    } else {
      this.globalSources = this.globalSources.filter(s => s.id !== sourceId);
    }
    this.saveSources();
    if (animeId) {
      this.sourceCache.delete(animeId);
    }
    this.syncToSupabase();
  }

  toggleSource(animeId: string | null, sourceId: string): void {
    const sources = animeId
      ? this.sources.get(animeId) || []
      : this.globalSources;

    const source = sources.find(s => s.id === sourceId);
    if (source) {
      source.active = !source.active;
      this.saveSources();
      if (animeId) {
        this.sourceCache.delete(animeId);
      }
      this.syncToSupabase();
    }
  }

  getAllSources(): { global: VideoSource[]; anime: Map<string, VideoSource[]> } {
    return {
      global: this.globalSources,
      anime: this.sources
    };
  }

  async syncToSupabase() {
    if (typeof window === 'undefined') return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const allSources = {
        global: this.globalSources,
        anime: Object.fromEntries(this.sources)
      };

      await supabase
        .from('video_sources')
        .upsert({
          user_id: user.id,
          sources: allSources,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      console.log('✅ Sources synced to Supabase');
    } catch (e) {
      console.error('Failed to sync sources:', e);
    }
  }

  async loadFromSupabase() {
    if (typeof window === 'undefined') return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('video_sources')
        .select('sources')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (data && data.sources) {
        this.globalSources = data.sources.global || [];
        this.sources = new Map(Object.entries(data.sources.anime || {}));
        this.saveSources();
        console.log('✅ Sources loaded from Supabase');
      }
    } catch (e) {
      console.log('No sources in Supabase, using local cache');
    }
  }
}

// ------------------------------------------------------------------
//  Singleton instance
// ------------------------------------------------------------------

export const videoSourceManager = new VideoSourceManager();