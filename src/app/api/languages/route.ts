import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseClient';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';

const DEFAULT_LANGUAGES = [
  { code: 'jap', name: 'Japanese', flag: '🇯🇵', type: 'SUB' },
  { code: 'eng', name: 'English', flag: '🇬🇧', type: 'DUB' },
  { code: 'hin', name: 'Hindi', flag: '🇮🇳', type: 'DUB' },
];

export async function GET() {
  const snapshot = await getDocs(collection(db, 'languages'));
  const custom = snapshot.docs.map(d => d.data());
  const langMap: any = {};
  DEFAULT_LANGUAGES.forEach(l => (langMap[l.code] = l));
  custom.forEach((l: any) => (langMap[l.code] = l));
  const languages = Object.values(langMap).filter((l: any) => !l.removed);
  return NextResponse.json({ languages });
}

export async function PUT(request: NextRequest) {
  try {
    const { languages } = await request.json();
    for (const lang of languages) {
      await setDoc(doc(db, 'languages', lang.code), lang, { merge: true });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}