// app/api/newly-added/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseClient';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function GET() {
  try {
    const docRef = doc(db, 'settings', 'newly_added');
    const docSnap = await getDoc(docRef);
    const ids = docSnap.exists() ? (docSnap.data().ids || []) : [];
    return NextResponse.json({ newlyAdded: ids });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const ids: string[] = body.ids || [];
    await setDoc(doc(db, 'settings', 'newly_added'), { ids }, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}