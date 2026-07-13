// app/api/send-notification/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';

// Initialise only once
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(request: NextRequest) {
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

    // Use webpush for platform‑specific options (image, icon)
    const response = await getMessaging().sendEachForMulticast({
      tokens,
      webpush: {
        notification: {
          title,
          body,
          icon: icon,
          image: icon,   // some browsers prefer this for a large image
        },
      },
    });

    return NextResponse.json({ success: true, response });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}