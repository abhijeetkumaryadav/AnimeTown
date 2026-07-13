// lib/fcm.ts
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from './firebaseClient';

let messaging: any = null;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  messaging = getMessaging(app);
}

export async function requestFCMToken(): Promise<string | null> {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, {
vapidKey: 'BC58JJD5ZvclJeWkzcCe_C-3TUD8S5-S56YXrwYePTDQJhznj72hWk3YrxRQpLLQk5t9VWU7abQ2-a8TyxWDCbY'    });
    return token;
  } catch (err) {
    console.error('FCM token error:', err);
    return null;
  }
}

export function listenForForegroundMessages() {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    new Notification(payload.notification?.title || 'AnimeTown', {
      body: payload.notification?.body || '',
      icon: payload.notification?.icon || '/favicon.ico',
    });
  });
}