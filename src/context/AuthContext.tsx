import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { User } from '../types';
import { authenticateAndAuthorizeUser, PRIMARY_ADMIN_EMAIL, USER_CACHE_KEY } from '../lib/observerAuth';
import { syncPendingReports } from '../lib/offlineStorage';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isFieldSupervisor: boolean;
  authError: string | null;
  isReauthenticating: boolean;
  clearAuthError: () => void;
  signOut: () => Promise<void>;
  reauthenticate: (forceTokenRefresh?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const EXPLICIT_SIGNOUT_FLAG = 'ivote_explicit_signout_in_progress';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(USER_CACHE_KEY);
    } catch {
      return true;
    }
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [isReauthenticating, setIsReauthenticating] = useState<boolean>(false);

  const isReauthenticatingRef = useRef<boolean>(false);
  const lastReauthTimestampRef = useRef<number>(0);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  /**
   * Performs silent re-authentication:
   * 1. Awaits Firebase auth state readiness
   * 2. Forces a silent ID token refresh via Google Identity without UI popups
   * 3. Re-verifies observer status in Firestore
   * 4. Automatically synchronizes any offline reports queued while disconnected
   * 5. Restores session persistence seamlessly without requiring a manual browser reload
   */
  const reauthenticate = useCallback(async (forceTokenRefresh = true) => {
    if (isReauthenticatingRef.current) return;
    isReauthenticatingRef.current = true;
    setIsReauthenticating(true);

    try {
      // 1. Ensure Firebase Auth has loaded credentials from browser IndexedDB
      if (typeof auth.authStateReady === 'function') {
        try {
          await auth.authStateReady();
        } catch (readyErr) {
          console.warn('Silent auth state readiness notice:', readyErr);
        }
      }

      let activeFUser = auth.currentUser;

      // In spotty mobile networks, Firebase socket initialization may take a moment to bind currentUser
      if (!activeFUser && typeof navigator !== 'undefined' && navigator.onLine) {
        for (let attempt = 0; attempt < 3; attempt++) {
          await new Promise((res) => setTimeout(res, 350));
          activeFUser = auth.currentUser;
          if (activeFUser) break;
        }
      }

      if (activeFUser) {
        setFirebaseUser(activeFUser);

        // 2. Silently refresh ID token against Google Identity servers to prevent expired token 401/403s
        if (forceTokenRefresh && typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            await activeFUser.getIdToken(true);
            await activeFUser.reload().catch(() => {});
            activeFUser = auth.currentUser || activeFUser;
          } catch (tokenErr) {
            console.warn('Silent token renewal notice:', tokenErr);
          }
        }

        // 3. Re-verify observer status and update local session cache
        try {
          const authorizedUser = await authenticateAndAuthorizeUser(activeFUser);
          setUser(authorizedUser);
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(authorizedUser));
          setAuthError(null);

          // Dispatch event so app components know session has been freshly validated
          window.dispatchEvent(new CustomEvent('ivote_auth_restored', { detail: authorizedUser }));

          // 4. Automatically trigger background sync of queued offline reports
          try {
            await syncPendingReports(authorizedUser.uid);
          } catch (syncErr) {
            console.warn('Automatic offline reports sync on reconnection notice:', syncErr);
          }
        } catch (authErr: any) {
          const isExplicitDenial = 
            authErr.message?.includes('Access Denied') || 
            authErr.message?.includes('Account Suspended');

          if (isExplicitDenial) {
            setUser(null);
            setFirebaseUser(null);
            localStorage.removeItem(USER_CACHE_KEY);
            setAuthError(authErr.message);
          } else {
            console.warn('Re-auth authorization notice (retaining offline session):', authErr?.message);
            // Retain cached authorized profile so observer is never disrupted
            const cached = localStorage.getItem(USER_CACHE_KEY);
            if (cached) {
              try {
                const parsed = JSON.parse(cached);
                if (parsed) setUser(parsed);
              } catch {}
            }
          }
        }
      } else {
        // If Firebase Auth currentUser is not available, check for stored observer session
        const cached = localStorage.getItem(USER_CACHE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.email) {
              setUser(parsed);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      console.warn('Silent re-authentication encountered an error:', err?.message || err);
    } finally {
      isReauthenticatingRef.current = false;
      setIsReauthenticating(false);
      setLoading(false);
    }
  }, []);

  /**
   * Explicit sign-out: cleanly terminates both the local session cache and Firebase session
   */
  const signOutUser = useCallback(async () => {
    try {
      sessionStorage.setItem(EXPLICIT_SIGNOUT_FLAG, 'true');
      localStorage.removeItem(USER_CACHE_KEY);
      setUser(null);
      setFirebaseUser(null);
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      sessionStorage.removeItem(EXPLICIT_SIGNOUT_FLAG);
    }
  }, []);

  // Main listener for Firebase Auth state transitions
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);

      if (fUser) {
        // Fast-path: Hydrate immediately from cached authorized session with zero visual latency
        try {
          const cached = localStorage.getItem(USER_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as User;
            if (
              parsed && 
              (parsed.uid === fUser.uid || parsed.email?.trim().toLowerCase() === fUser.email?.trim().toLowerCase())
            ) {
              setUser(parsed);
              setLoading(false);
            }
          }
        } catch (e) {
          // ignore cache read error
        }

        // If currently offline, retain local authorized profile without attempting network calls
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setLoading(false);
          return;
        }

        try {
          const authorizedUser = await authenticateAndAuthorizeUser(fUser);
          setUser(authorizedUser);
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(authorizedUser));
          setAuthError(null);
        } catch (error: any) {
          console.warn("Auth check notice:", error?.message);
          const isExplicitDenial = error.message?.includes('Access Denied') || error.message?.includes('Account Suspended');

          if (isExplicitDenial) {
            setUser(null);
            setFirebaseUser(null);
            localStorage.removeItem(USER_CACHE_KEY);
            setAuthError(error.message);
          } else {
            // Transient network error / offline: ALWAYS preserve cached authorized user session
            const cached = localStorage.getItem(USER_CACHE_KEY);
            if (cached) {
              try {
                const parsed = JSON.parse(cached);
                if (
                  parsed && 
                  (parsed.uid === fUser.uid || parsed.email?.trim().toLowerCase() === fUser.email?.trim().toLowerCase())
                ) {
                  setUser(parsed);
                  setLoading(false);
                  return;
                }
              } catch (e) {
                // Ignore JSON parse error
              }
            }
          }
        }
      } else {
        // fUser is null. Check if this was an intentional explicit sign out.
        const isExplicitSignOut = sessionStorage.getItem(EXPLICIT_SIGNOUT_FLAG) === 'true';
        if (isExplicitSignOut) {
          setUser(null);
          localStorage.removeItem(USER_CACHE_KEY);
          setLoading(false);
          return;
        }

        // If not explicit sign-out, preserve cached authorized user session:
        // Firebase Auth can momentarily emit null during network transitions or offline operation
        const cached = localStorage.getItem(USER_CACHE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.email) {
              setUser(parsed);
              setLoading(false);

              // If online, trigger silent re-authentication to recover currentUser rather than logging out
              if (typeof navigator !== 'undefined' && navigator.onLine) {
                reauthenticate(true);
              }
              return;
            }
          } catch (e) {
            // ignore
          }
        }

        setUser(null);
        localStorage.removeItem(USER_CACHE_KEY);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [reauthenticate]);

  // Network lifecycle & visibility listeners: silently restore session when returning online
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network reconnected: Restoring observer session persistence silently...');
      reauthenticate(true);
    };

    const handleVisibilityOrFocus = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const now = Date.now();
        // Throttle tab switch checks to at most once every 15 seconds
        if (now - lastReauthTimestampRef.current > 15000) {
          lastReauthTimestampRef.current = now;
          reauthenticate(false);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // Initial check: if app is already online, perform background validation
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      reauthenticate(false);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [reauthenticate]);

  const isSupervisor = user?.role === 'field_supervisor' || user?.role === 'supervisor';

  const value = {
    user,
    firebaseUser,
    loading,
    isAdmin: user?.role === 'admin' || firebaseUser?.email === PRIMARY_ADMIN_EMAIL,
    isSupervisor,
    isFieldSupervisor: isSupervisor,
    authError,
    isReauthenticating,
    clearAuthError,
    signOut: signOutUser,
    reauthenticate,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


