import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, setDoc, collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { app, db, handleFirestoreError, OperationType } from './firebase';
import defaultConfig from '../../firebase-applet-config.json';
import { toast } from 'sonner';

let messagingInstance: Messaging | null = null;
let messagingSupportedPromise: Promise<boolean> | null = null;

const env = (import.meta as any).env || {};
const VAPID_KEY = env.VITE_FIREBASE_VAPID_KEY || (defaultConfig as any).vapidKey;

/**
 * Safely initialize FCM Messaging instance if supported by the browser environment
 */
export async function getFcmMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  if (!messagingSupportedPromise) {
    messagingSupportedPromise = isSupported().catch((err) => {
      console.warn('FCM Messaging support check failed:', err);
      return false;
    });
  }

  const supported = await messagingSupportedPromise;
  if (supported) {
    try {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    } catch (err) {
      console.warn('Failed to initialize FCM messaging:', err);
      return null;
    }
  }
  return null;
}

export interface PushNotificationMetadata {
  state?: string;
  lga?: string;
  pollingUnitId?: string;
  displayName?: string;
}

/**
 * Get current push notification status
 */
export function getPushNotificationStatus(): {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
} {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, permission: 'unsupported' };
  }
  return {
    supported: true,
    permission: Notification.permission
  };
}

/**
 * Request notification permission from browser and register FCM token
 */
export async function requestFcmNotificationPermission(
  userId?: string, 
  userRole?: string,
  metadata?: PushNotificationMetadata
): Promise<{ granted: boolean; token?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('This browser does not support desktop push notifications.');
    return { granted: false };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied by user.');
      return { granted: false };
    }

    // Register Service Worker for push background handling if available
    let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        serviceWorkerRegistration = await navigator.serviceWorker.ready;
      } catch (e) {
        console.warn('Service worker not ready for FCM token:', e);
      }
    }

    const messaging = await getFcmMessaging();
    let token: string | undefined;

    if (messaging) {
      try {
        token = await getToken(messaging, {
          vapidKey: VAPID_KEY || (defaultConfig as any).vapidKey || undefined,
          serviceWorkerRegistration
        });

        if (token && userId) {
          console.log('FCM Registration Token acquired:', token);
          // Store token in Firestore for targeted push messaging
          await setDoc(doc(db, 'fcm_tokens', token), {
            userId,
            userRole: userRole || 'observer',
            token,
            state: metadata?.state || null,
            lga: metadata?.lga || null,
            pollingUnitId: metadata?.pollingUnitId || null,
            displayName: metadata?.displayName || null,
            updatedAt: serverTimestamp(),
            platform: 'web_pwa',
            active: true
          }, { merge: true });

          // Also attach token to user profile
          await setDoc(doc(db, 'users', userId), {
            fcmToken: token,
            notificationsEnabled: true,
            pushSubscribed: true,
            lastTokenUpdate: serverTimestamp()
          }, { merge: true });
        }
      } catch (tokenErr) {
        console.warn('Could not retrieve FCM token (using local Push Notification fallback):', tokenErr);
      }
    }

    // If token wasn't acquired via FCM, record local push registration for the user
    if (userId && !token) {
      await setDoc(doc(db, 'users', userId), {
        notificationsEnabled: true,
        pushSubscribed: true,
        lastTokenUpdate: serverTimestamp()
      }, { merge: true }).catch(() => {});
    }

    return { granted: true, token };
  } catch (err) {
    console.error('Error requesting FCM notification permission:', err);
    return { granted: false };
  }
}

/**
 * Trigger an OS / Browser System Notification directly (works when app is in background or foreground)
 */
export async function triggerSystemPushNotification(options: {
  title: string;
  body: string;
  icon?: string;
  link?: string;
  tag?: string;
  isSosAlert?: boolean;
  priority?: 'critical' | 'urgent' | 'normal';
}) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const isEmergency = options.isSosAlert || options.priority === 'critical' || options.priority === 'urgent';
  const title = options.title || (isEmergency ? '🚨 URGENT EMERGENCY DECLARATION' : '📢 HQ DIRECTIVE BROADCAST');
  const body = options.body;
  const icon = options.icon || '/pwa-icon.svg';
  const tag = options.tag || (isEmergency ? `emergency-${Date.now()}` : `directive-${Date.now()}`);
  const link = options.link || '/dashboard';

  // Play browser emergency audio alarm
  if (isEmergency) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1600, ctx.currentTime + 0.3);
        osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.7);
      }
    } catch {
      // Audio context policy
    }
  }

  // Use ServiceWorkerRegistration showNotification if available (ensures OS level system push banner)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(title, {
          body,
          icon,
          badge: '/pwa-icon.svg',
          tag,
          renotify: true,
          requireInteraction: isEmergency,
          vibrate: isEmergency ? [500, 200, 500, 200, 500, 200, 800] : [200, 100, 200],
          data: { url: link },
          actions: isEmergency ? [
            { action: 'open_directive', title: '🚨 Inspect Emergency Memo' },
            { action: 'acknowledge', title: '✅ Acknowledge' }
          ] : [
            { action: 'open_directive', title: 'View Update' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        } as any);
        return;
      }
    } catch (swErr) {
      console.warn('Service worker showNotification fallback to window.Notification:', swErr);
    }
  }

  // Fallback to standard window.Notification
  try {
    const notif = new Notification(title, {
      body,
      icon,
      tag,
      requireInteraction: isEmergency,
      data: { url: link }
    });

    notif.onclick = (e) => {
      e.preventDefault();
      window.focus();
      if (link) {
        window.location.href = link;
      }
      notif.close();
    };
  } catch (nErr) {
    console.warn('System Notification error:', nErr);
  }
}

/**
 * Send an immediate test Web Push notification to current browser
 */
export async function sendTestWebPushNotification() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    toast.error('Notifications not supported in this browser');
    return false;
  }

  if (Notification.permission !== 'granted') {
    const res = await requestFcmNotificationPermission();
    if (!res.granted) {
      toast.error('Push notification permission denied in browser settings.');
      return false;
    }
  }

  await triggerSystemPushNotification({
    title: '🚨 TEST EMERGENCY WEB PUSH ALERT',
    body: 'Web Push channel active! Observers receive instant emergency declarations & critical updates via this protocol.',
    link: '/dashboard',
    isSosAlert: true,
    priority: 'urgent'
  });

  toast.success('Test Web Push Notification Dispatched!', {
    description: 'Check your device notification center for the incoming test alert.'
  });
  return true;
}

/**
 * Listen for foreground FCM messages
 */
export async function registerFcmForegroundHandler(onMessageReceived: (payload: any) => void) {
  const messaging = await getFcmMessaging();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground message received:', payload);
    onMessageReceived(payload);

    // Trigger system push notification if tab is in background or hidden
    if (document.hidden) {
      triggerSystemPushNotification({
        title: payload.notification?.title || payload.data?.title || '🚨 EMERGENCY DANGER SOS',
        body: payload.notification?.body || payload.data?.body || 'New high priority incident reported.',
        link: payload.data?.link || '/dashboard',
        isSosAlert: true,
        priority: 'urgent'
      });
    }
  });
}

