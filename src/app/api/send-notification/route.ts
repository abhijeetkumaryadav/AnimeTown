// app/api/send-notification/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';

// This runs only on the server, but we must guard against missing env variables
const privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
const projectId = process.env.FIREBASE_PROJECT_ID || '';

let initialized = false;
if (privateKey && clientEmail && projectId && !getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    initialized = true;
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

export async function POST(request: NextRequest) {
  // If Firebase Admin is not initialized, return an error
  if (!initialized) {
    return NextResponse.json(
      { error: 'Server configuration error: Firebase credentials not set' },
      { status: 500 }
    );
  }

  try {
    const { title, body, icon } = await request.json();

    const db = getFirestore();
    const tokensSnap = await db.collection('fcm_tokens').get();
    const tokens: string[] = [];
    tokensSnap.forEach(doc => {
      const data = doc.data();
      if (data.token) tokens.push(data.token);
    });

    if (tokens.length === 0) {
      return NextResponse.json({ success: false, message: 'No tokens' });
    }

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      webpush: {
        notification: {
          title,
          body,
          icon: icon,
          image: icon,
        },
      },
    });

    return NextResponse.json({ success: true, response });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}