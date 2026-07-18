import { NextRequest, NextResponse } from 'next/server';

async function searchVidnest(query: string): Promise<any[]> {
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query ($search: String) {
            Page(page: 1, perPage: 10) {
              media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
                id
                title {
                  romaji
                  english
                  native
                }
                coverImage {
                  large
                }
                description
                episodes
                format
                status
                averageScore
                startDate {
                  year
                }
                genres
                studios {
                  nodes {
                    name
                  }
                }
              }
            }
          }
        `,
        variables: { search: query }
      })
    });

    const data = await response.json();
    const results = data?.data?.Page?.media || [];

    return results.map((media: any) => ({
      id: `vn-${media.id}`,
      anilistId: media.id,
      title: media.title?.english || media.title?.romaji || 'Unknown',
      image: media.coverImage?.large || 'https://via.placeholder.com/200x300',
      description: media.description?.replace(/<[^>]*>/g, '') || '',
      episodes: media.episodes || 0,
      type: media.format || 'TV',
      year: media.startDate?.year || new Date().getFullYear(),
      score: (media.averageScore || 0) / 10,
      genre: media.genres?.join(', ') || '',
      studio: media.studios?.nodes?.[0]?.name || 'Unknown',
      status: media.status || 'Ongoing',
      source: 'vidnest'
    }));
  } catch (error) {
    console.error('Vidnest search error:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('search') || '';
  const type = searchParams.get('type') || 'anime'; // 'anime' or 'animepahe'
  
  if (!query) {
    return NextResponse.json({ error: 'Search query required' }, { status: 400 });
  }

  const results = await searchVidnest(query);
  return NextResponse.json({ results, type });
}