// app/api/news-fetch/route.ts
import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['description', 'fullDescription'],
    ],
  },
});

export async function GET() {
  try {
    const feed = await parser.parseURL('https://www.animenewsnetwork.com/news/rss.xml');

    const articles = feed.items.map((item: any) => {
      // Extract image from multiple possible sources
      let image = '';

      // 1. Check media:content (main image)
      if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
        image = item.mediaContent.$.url;
      }
      // 2. Check media:thumbnail
      else if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
        image = item.mediaThumbnail.$.url;
      }
      // 3. Check enclosure
      else if (item.enclosure && item.enclosure.link) {
        image = item.enclosure.link;
      }
      // 4. Extract from content/description HTML
      else if (item.content || item.fullDescription) {
        const html = item.content || item.fullDescription || '';
        const imgMatch = html.match(/<img[^>]+src="([^">]+)"/);
        if (imgMatch) image = imgMatch[1];
      }

      // 5. If still no image, use a generic anime-themed placeholder (not unsplash)
      if (!image) {
        image = 'https://cdn.animenewsnetwork.com/common/images/ann_logo.png';
      }

      // Clean the content - keep full HTML or strip based on preference
      const content = item.content || item.fullDescription || item.description || 'No content available';
      const cleanContent = content.replace(/<[^>]+>/g, ' ').trim();

      return {
        title: item.title || 'No title',
        content: cleanContent.substring(0, 2000), // Keep full content, limit to 2000 chars
        image: image,
        date: item.pubDate || new Date().toISOString(),
        author: item.author || 'Anime News Network',
        link: item.link || '',
      };
    });

    return NextResponse.json({ articles });
  } catch (error) {
    console.error('News fetch error:', error);
    return NextResponse.json({ articles: [] }, { status: 500 });
  }
}