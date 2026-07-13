// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDm_UhHtks4FRM_C_Jeqeko6TIoOBrdpg0",
  authDomain: "animetown-1fce4.firebaseapp.com",
  projectId: "animetown-1fce4",
  storageBucket: "animetown-1fce4.firebasestorage.app",
  messagingSenderId: "790702206296",
  appId: "1:790702206296:web:75324ff2d45bb6b97e892d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || payload.data;
  self.registration.showNotification(title || 'AnimeTown', {
    body: body || '',
    icon: icon || '/favicon.ico',
    data: payload.data,
  });
});