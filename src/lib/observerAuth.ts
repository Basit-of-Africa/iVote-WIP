import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { User as FirebaseUser, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { User } from '../types';

export const PRIMARY_ADMIN_EMAIL = 'ajibadebasit40@gmail.com';
export const USER_CACHE_KEY = 'ivote_authorized_user_session';

/**
 * Checks if an error is related to network connectivity or client offline status.
 */
function isNetworkOrOfflineError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    typeof navigator !== 'undefined' && !navigator.onLine ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('unavailable') ||
    msg.includes('failed to fetch') ||
    msg.includes('timeout') ||
    err.code === 'unavailable' ||
    err.code === 'failed-precondition'
  );
}

/**
 * Verifies whether a user logging in via Google Auth is on the imported observer roster or is an admin.
 * If authorized, binds or creates their User profile in Firestore.
 * Ensures offline observers are NEVER logged out when data connection drops.
 */
export async function authenticateAndAuthorizeUser(fUser: FirebaseUser): Promise<User> {
  // If user object or email is missing
  if (!fUser || !fUser.email) {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      try {
        const cached = localStorage.getItem(USER_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.email) return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    await signOut(auth);
    throw new Error('Authentication failed: No valid email address associated with your Google account.');
  }

  const userEmail = fUser.email.trim().toLowerCase();

  // 1. Check local session cache first: if offline, immediately return cached authorized session
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  try {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as User;
      if (
        parsed && 
        (parsed.uid === fUser.uid || parsed.email?.trim().toLowerCase() === userEmail)
      ) {
        if (parsed.status === 'suspended') {
          await signOut(auth);
          localStorage.removeItem(USER_CACHE_KEY);
          throw new Error(`Account Suspended: The observer account for ${fUser.email} has been suspended. Please contact an administrator.`);
        }
        // If offline, rely on cached authorized profile directly without risky network calls
        if (isOffline) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Session cache read notice:', e);
  }

  // 2. Check if user already has an established user profile by UID in Firestore (reads from IndexedDB offline cache if offline)
  const userRef = doc(db, 'users', fUser.uid);
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const existingUser = userSnap.data() as User;
      if (existingUser.status === 'suspended') {
        await signOut(auth);
        localStorage.removeItem(USER_CACHE_KEY);
        throw new Error(`Account Suspended: The observer account for ${fUser.email} has been suspended. Please contact an administrator.`);
      }
      // Refresh local cache with latest Firestore record
      try {
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(existingUser));
      } catch (e) {
        // ignore
      }
      return existingUser;
    }
  } catch (err: any) {
    if (err.message && err.message.includes('Account Suspended')) {
      throw err;
    }
    // If the error was due to network disconnect/offline, fallback to cached session if available
    if (isNetworkOrOfflineError(err)) {
      try {
        const cached = localStorage.getItem(USER_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as User;
          if (parsed && (parsed.uid === fUser.uid || parsed.email?.trim().toLowerCase() === userEmail)) {
            return parsed;
          }
        }
      } catch (e) {
        // ignore
      }
      // Never sign out on network issues!
      throw new Error('Network connection unavailable. Operating in offline persistence mode.');
    }
    console.warn('Notice fetching user record by UID:', err);
  }

  // 3. Primary Admin check
  if (userEmail === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
    const adminUser: User = {
      uid: fUser.uid,
      displayName: fUser.displayName || 'System Administrator',
      email: fUser.email,
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(adminUser));
      await setDoc(userRef, { ...adminUser, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.warn('Could not write admin profile to Firestore (offline fallback enabled):', e);
    }
    return adminUser;
  }

  // 4. If offline and not in cache, do NOT sign out! Alert user to connect once
  if (isOffline) {
    throw new Error('You are currently offline. Please connect to the internet once to synchronize your authorized observer credentials.');
  }

  // 5. Search Firestore `users` collection for imported observer record matching email
  let matchedObserverRecord: Partial<User> | null = null;

  try {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('email', '==', fUser.email));
    const querySnap = await getDocs(q);

    if (!querySnap.empty) {
      matchedObserverRecord = querySnap.docs[0].data() as User;
    } else {
      // Case-insensitive fallback scan
      const allSnap = await getDocs(usersCol);
      const found = allSnap.docs.find(d => {
        const dData = d.data();
        return dData.email && dData.email.trim().toLowerCase() === userEmail;
      });
      if (found) {
        matchedObserverRecord = found.data() as User;
      }
    }
  } catch (err: any) {
    console.warn('Error querying Firestore for imported observer email:', err);
    // If querying failed due to network / offline: NEVER sign out!
    if (isNetworkOrOfflineError(err)) {
      try {
        const cached = localStorage.getItem(USER_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as User;
          if (parsed && (parsed.uid === fUser.uid || parsed.email?.trim().toLowerCase() === userEmail)) {
            return parsed;
          }
        }
      } catch (e) {
        // ignore
      }
      throw new Error('Network connection error while checking observer roster. Please check your data connection.');
    }
  }

  // 6. Evaluate result against real Firestore records ONLY when network request completed successfully
  if (!matchedObserverRecord) {
    await signOut(auth);
    localStorage.removeItem(USER_CACHE_KEY);
    throw new Error(
      `Access Denied: The email address "${fUser.email}" is not registered on the authorized observer roster. Only imported observers can log in. Please contact an administrator to upload your email address via the CSV Template.`
    );
  }

  if (matchedObserverRecord.status === 'suspended') {
    await signOut(auth);
    localStorage.removeItem(USER_CACHE_KEY);
    throw new Error(`Account Suspended: The observer account for ${fUser.email} has been suspended. Please contact an administrator.`);
  }

  // 7. Bind imported record to this user's Google UID in `users/{fUser.uid}`
  const userRole = matchedObserverRecord.role || 'observer';
  const defaultDisplayName = userRole === 'admin' 
    ? 'System Administrator' 
    : (userRole === 'field_supervisor' || userRole === 'supervisor') 
    ? 'Field Supervisor' 
    : 'Field Observer';

  const newUserProfile: User = {
    uid: fUser.uid,
    displayName: matchedObserverRecord.displayName || fUser.displayName || defaultDisplayName,
    email: fUser.email,
    phone: matchedObserverRecord.phone || '',
    role: userRole,
    assignedPollingUnitId: matchedObserverRecord.assignedPollingUnitId || '',
    assignedPollingUnitName: matchedObserverRecord.assignedPollingUnitName || '',
    state: matchedObserverRecord.state || 'Lagos',
    lga: matchedObserverRecord.lga || '',
    status: 'active',
    createdAt: matchedObserverRecord.createdAt || new Date().toISOString(),
  };

  // Cache immediately in local storage so subsequent offline transitions are instant
  try {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(newUserProfile));
  } catch (err) {
    console.warn('Could not cache user profile to localStorage:', err);
  }

  try {
    await setDoc(userRef, {
      ...newUserProfile,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('Error saving linked observer profile to Firestore (cached locally):', err);
  }

  return newUserProfile;
}

/**
 * Directly authenticates and authorizes an observer or administrator by email.
 * Ideal for environments where Google OAuth popups encounter auth/unauthorized-domain,
 * during spotty field operations, or for rapid testing by supervisors.
 */
export async function authenticateDirectObserver(
  emailInput: string,
  requestedRole?: 'admin' | 'supervisor' | 'field_supervisor' | 'observer',
  requestedName?: string
): Promise<User> {
  const cleanEmail = emailInput.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Please enter a valid observer email address.');
  }

  const isLeadAdmin = cleanEmail === PRIMARY_ADMIN_EMAIL.toLowerCase();

  // Try to search Firestore for an existing or pre-imported observer record
  let matchedObserverRecord: Partial<User> | null = null;
  try {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('email', '==', cleanEmail));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      matchedObserverRecord = querySnap.docs[0].data() as User;
    }
  } catch (e) {
    console.warn('Direct auth Firestore search notice:', e);
  }

  const role = isLeadAdmin 
    ? 'admin' 
    : matchedObserverRecord?.role || requestedRole || 'observer';

  const defaultDisplayName = isLeadAdmin
    ? 'Basit Ajibade (Lead Admin)'
    : matchedObserverRecord?.displayName || requestedName || (
        cleanEmail.split('@')[0]
          .replace(/[._]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase()) + ' (Observer)'
      );

  const uid = isLeadAdmin
    ? 'admin_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')
    : matchedObserverRecord?.uid || 'obs_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

  const userProfile: User = {
    uid,
    displayName: defaultDisplayName,
    email: cleanEmail,
    role: role as any,
    phone: matchedObserverRecord?.phone || '+234 803 555 0192',
    assignedPollingUnitId: matchedObserverRecord?.assignedPollingUnitId || 'PU-OSUN-04-12-008',
    assignedPollingUnitName: matchedObserverRecord?.assignedPollingUnitName || 'Community Grammar School, Ward 04',
    state: matchedObserverRecord?.state || 'Osun',
    lga: matchedObserverRecord?.lga || 'Osogbo',
    status: 'active',
    createdAt: matchedObserverRecord?.createdAt || new Date().toISOString()
  };

  try {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userProfile));
  } catch (e) {
    console.warn('Local storage write notice:', e);
  }

  // Attempt to store in Firestore in background without blocking
  try {
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, {
      ...userProfile,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('Could not write direct observer record to Firestore:', e);
  }

  return userProfile;
}

