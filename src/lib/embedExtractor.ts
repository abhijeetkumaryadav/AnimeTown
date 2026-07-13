// lib/embedExtractor.ts

export interface EmbedInfo {
  type: 'iframe' | 'direct' | 'hls';
  url: string;
  error?: string;
}

export class EmbedExtractor {
  // Try to find the actual video URL from a page
  static async extractVideoUrl(pageUrl: string): Promise<EmbedInfo> {
    try {
      // For Nxsha - they have an embed pattern
      if (pageUrl.includes('nxsha.app')) {
        const match = pageUrl.match(/\/watch\/tv\/(\d+)\/(\d+)\/(\d+)/);
        if (match) {
          const [_, showId, season, episode] = match;
          // Nxsha might have an embed endpoint
          return {
            type: 'iframe',
            url: `https://web.nxsha.app/embed/tv/${showId}/${season}/${episode}`
          };
        }
      }

      // For 2dhive - extract episode ID
      if (pageUrl.includes('2dhive.com')) {
        const match = pageUrl.match(/anime=(\d+)&ep_num=(\d+)/);
        if (match) {
          const [_, animeId, epNum] = match;
          // Try different embed patterns
          return {
            type: 'iframe',
            url: `https://2dhive.com/embed?anime=${animeId}&ep=${epNum}`
          };
        }
      }

      // For 4Animo
      if (pageUrl.includes('4animo.xyz')) {
        return {
          type: 'iframe',
          url: pageUrl.replace('/watch/', '/embed/')
        };
      }

      // For Miruro
      if (pageUrl.includes('miruro.to')) {
        const match = pageUrl.match(/\/watch\/(\d+)\/(.+)\?ep=(\d+)/);
        if (match) {
          const [_, id, title, ep] = match;
          return {
            type: 'iframe',
            url: `https://www.miruro.to/embed/${id}/${title}?ep=${ep}`
          };
        }
      }

      // Default - try to embed as-is
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

  // Try multiple embed patterns for a site
  static getPossibleEmbeds(url: string): string[] {
    const possibilities: string[] = [url];
    
    // Nxsha patterns
    if (url.includes('nxsha.app')) {
      const match = url.match(/\/watch\/tv\/(\d+)\/(\d+)\/(\d+)/);
      if (match) {
        const [_, showId, season, episode] = match;
        possibilities.push(
          `https://web.nxsha.app/embed/tv/${showId}/${season}/${episode}`,
          `https://nxsha.app/embed/tv/${showId}/${season}/${episode}`
        );
      }
    }

    // 2dhive patterns
    if (url.includes('2dhive.com')) {
      const match = url.match(/anime=(\d+)&ep_num=(\d+)/);
      if (match) {
        const [_, animeId, epNum] = match;
        possibilities.push(
          `https://2dhive.com/embed?anime=${animeId}&ep=${epNum}`,
          `https://2dhive.com/player?anime=${animeId}&ep=${epNum}`
        );
      }
    }

    // 4Animo patterns
    if (url.includes('4animo.xyz')) {
      possibilities.push(url.replace('/watch/', '/embed/'));
      possibilities.push(url.replace('?ep=', '/episode-'));
    }

    return possibilities;
  }
}