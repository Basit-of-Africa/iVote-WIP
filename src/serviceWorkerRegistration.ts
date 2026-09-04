import { syncPendingReports } from './lib/offlineStorage';

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'test') {
    window.addEventListener('load', () => {
      const swUrl = '/sw.js';

      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          console.log('[SW] ServiceWorker registered successfully with scope:', registration.scope);

          // Handle updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) return;

            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[SW] New content is available and will be used when all tabs are closed.');
                } else {
                  console.log('[SW] Content is cached for offline use.');
                }
              }
            };
          };
        })
        .catch((error) => {
          console.error('[SW] Error during service worker registration:', error);
        });

      // Listen for messages sent from the Service Worker (e.g. background sync triggers)
      navigator.serviceWorker.addEventListener('message', async (event) => {
        if (event.data && event.data.type === 'SW_SYNC_PENDING_REPORTS') {
          console.log('[SW] Received background sync trigger from Service Worker');
          if (navigator.onLine) {
            try {
              const res = await syncPendingReports();
              if (res.successCount > 0) {
                console.log(`[SW Sync] Auto-synced ${res.successCount} pending report(s)`);
              }
            } catch (err) {
              console.warn('[SW Sync] Background sync error:', err);
            }
          }
        }
      });
    });
  }
}

// Request Background Sync if supported by the browser
export async function requestBackgroundReportSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register('sync-reports');
      console.log('[SW] Registered background sync tag: sync-reports');
    } catch (err) {
      console.warn('[SW] Background sync registration failed, falling back to online listener:', err);
    }
  } else if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    // Fallback: post message directly to SW
    navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_REPORT_SYNC' });
  }
}
