// lib/embedDetector.ts

export interface EmbedResult {
  success: boolean;
  url: string;
  type: 'iframe' | 'direct' | 'hls' | 'proxy';
  error?: string;
}

export class EmbedDetector {
  private static patterns: Record<string, (url: string) => string | null> = {
    // Vidnest - working
    'vidnest.fun': (url) => {
      const match = url.match(/anime\/(\d+)\/(\d+)\/(\w+)/);
      if (match) {
        const [_, id, ep, lang] = match;
        return `https://vidnest.fun/anime/${id}/${ep}/${lang}`;
      }
      const paheMatch = url.match(/animepahe\/(\d+)\/(\d+)\/(\w+)/);
      if (paheMatch) {
        const [_, id, ep, lang] = paheMatch;
        return `https://vidnest.fun/animepahe/${id}/${ep}/${lang}`;
      }
      return null;
    },

    // Nxsha - working embed
    'nxsha.app': (url) => {
      const match = url.match(/\/watch\/tv\/(\d+)\/(\d+)\/(\d+)/);
      if (match) {
        const [_, showId, season, episode] = match;
        return `https://web.nxsha.app/embed/tv/${showId}/${season}/${episode}`;
      }
      return null;
    },

    // Miruro - working embed
    'miruro.to': (url) => {
      const match = url.match(/\/watch\/(\d+)\/(.+?)\?ep=(\d+)/);
      if (match) {
        const [_, id, title, ep] = match;
        return `https://www.miruro.to/embed/${id}/${title}?ep=${ep}`;
      }
      return null;
    },

    // Animotvslash - FIXED: remove double slash
    'animotvslash.org': (url) => {
      const match = url.match(/\/(.+?)-episode-(\d+)/);
      if (match) {
        const [_, title, ep] = match;
        return `https://animotvslash.org/embed/${title}-episode-${ep}`;
      }
      return null;
    },

    // 2DHive - FIXED
    '2dhive.com': (url) => {
      const match = url.match(/anime=(\d+)&ep_num=(\d+)/);
      if (match) {
        const [_, animeId, epNum] = match;
        return `https://2dhive.com/embed?anime=${animeId}&ep_num=${epNum}`;
      }
      return null;
    },

    // 4Animo - FIXED
    '4animo.xyz': (url) => {
      const match = url.match(/\/watch\/(.+?)\?ep=(\d+)/);
      if (match) {
        const [_, title, ep] = match;
        return `https://4animo.xyz/embed/${title}?ep=${ep}`;
      }
      return null;
    },

    // KickAssAnime - FIXED
    'kickassanime.com.es': (url) => {
      const match = url.match(/\/(.+?)-episode-(\d+)/);
      if (match) {
        const [_, title, ep] = match;
        return `https://kickassanime.com.es/embed/${title}-episode-${ep}`;
      }
      return null;
    },

    // AnimeFreak - FIXED
    'animefreak.co.in': (url) => {
      const match = url.match(/\/episodes\/(.+?)-(\d+)x(\d+)/);
      if (match) {
        const [_, title, season, ep] = match;
        return `https://animefreak.co.in/embed/${title}-${season}x${ep}`;
      }
      return null;
    },

    // OK.ru - working
    'ok.ru': (url) => {
      const match = url.match(/\/video\/(\d+)/);
      if (match) {
        const [_, videoId] = match;
        return `https://ok.ru/videoembed/${videoId}`;
      }
      return null;
    },

    // YouTube - FIXED
    'youtube.com': (url) => {
      const match = url.match(/(?:watch\?v=|youtu.be\/)([a-zA-Z0-9_-]{11})/);
      if (match) {
        const [_, videoId] = match;
        return `https://www.youtube.com/embed/${videoId}`;
      }
      return null;
    },

    // Vimeo - FIXED
    'vimeo.com': (url) => {
      const match = url.match(/\/\/(\d+)/);
      if (match) {
        const [_, videoId] = match;
        return `https://player.vimeo.com/video/${videoId}`;
      }
      return null;
    },

    // Screenscape - already working
    'screenscape.me': (url) => {
      if (url.includes('tmdb=') || url.includes('imdb=')) {
        return url;
      }
      return null;
    }
  };

  static detectEmbed(url: string): EmbedResult {
    const urlLower = url.toLowerCase();
    
    for (const [domain, handler] of Object.entries(this.patterns)) {
      if (urlLower.includes(domain)) {
        const embedUrl = handler(url);
        if (embedUrl) {
          return {
            success: true,
            url: embedUrl,
            type: 'iframe'
          };
        }
      }
    }

    return {
      success: false,
      url: url,
      type: 'iframe',
      error: 'No embed pattern found'
    };
  }
}