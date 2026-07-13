import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseClient';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

export async function GET() {
  const snapshot = await getDocs(collection(db, 'schedule'));
  const schedule = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ schedule });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const docRef = await addDoc(collection(db, 'schedule'), body);
    return NextResponse.json({ success: true, item: { id: docRef.id, ...body } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    await updateDoc(doc(db, 'schedule', id), updates);
    return NextResponse.json({ success: true, item: { id, ...updates } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    await deleteDoc(doc(db, 'schedule', id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}