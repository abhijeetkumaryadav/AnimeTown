import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseClient';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const FEATURED_DOC_ID = 'featured_ids';

export async function GET() {
  const ref = doc(db, 'featured', FEATURED_DOC_ID);
  const snap = await getDoc(ref);
  const ids = snap.exists() ? snap.data()?.ids || [] : [];
  return NextResponse.json({ featured: ids });
}

export async function PUT(request: NextRequest) {
  try {
    const { ids } = await request.json();
    await setDoc(doc(db, 'featured', FEATURED_DOC_ID), { ids }, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}