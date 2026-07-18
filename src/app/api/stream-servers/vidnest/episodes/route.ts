import { NextRequest, NextResponse } from 'next/server';

function getVidnestLanguageParam(language: string): string {
  const lower = language.toLowerCase();
  if (lower === 'sub' || lower === 'dub') return lower;
  return 'sub'; // default
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const anilistId = searchParams.get('anilistId');
  const totalEpisodes = parseInt(searchParams.get('totalEpisodes') || '0');
  const type = searchParams.get('type') || 'anime';
  const language = searchParams.get('language') || 'sub';

  if (!anilistId) {
    return NextResponse.json({ error: 'anilistId required' }, { status: 400 });
  }

  const vidnestLang = getVidnestLanguageParam(language);
  const baseUrl = type === 'animepahe' 
    ? `https://vidnest.fun/animepahe/${anilistId}`
    : `https://vidnest.fun/anime/${anilistId}`;
  
  const epCount = totalEpisodes > 0 ? totalEpisodes : 12;
  const episodes = [];
  for (let i = 1; i <= epCount; i++) {
    episodes.push({
      number: i,
      link: `${baseUrl}/${i}/${vidnestLang}`
    });
  }

  return NextResponse.json({ episodes, type, language: vidnestLang });
}