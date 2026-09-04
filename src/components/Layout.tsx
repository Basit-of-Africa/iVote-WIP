import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import NotificationCenter from './NotificationCenter';
import OfflineSyncBanner from './OfflineSyncBanner';
import FirstTimeLocationPrompt from './FirstTimeLocationPrompt';
import DangerButton from './DangerButton';
import ActiveSOSBanner from './ActiveSOSBanner';
import ActiveDirectivesBanner from './ActiveDirectivesBanner';
import InstallPWABanner, { InstallPWAButton } from './InstallPWA';
import ElectionScopeSelector from './ElectionScopeSelector';
import ObserverOnboarding from './ObserverOnboarding';
import PushNotificationPrompt from './PushNotificationPrompt';
import ObserverFAB from './ObserverFAB';
import { 
  LayoutDashboard, 
  FileText, 
  FilePlus,
  AlertTriangle, 
  LogOut, 
  Menu, 
  X,
  Vote,
  Map as MapIcon,
  Wifi,
  WifiOff,
  Users,
  Globe,
  BookOpen,
  ShieldCheck
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onSnapshotsInSync } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Layout() {
  const { user, isAdmin, isSupervisor, signOut: logoutUser } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Escape key listener for accessible modal / mobile menu dismiss
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMobileMenuOpen) setIsMobileMenuOpen(false);
        if (showGuidelinesModal) setShowGuidelinesModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Track Firestore sync status
    const unsubscribeSync = onSnapshotsInSync(db, () => {
      setIsSyncing(false);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribeSync();
    };
  }, [isMobileMenuOpen, showGuidelinesModal]);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Public Live Feed', href: '/', icon: Globe },
    { name: 'Incident Map', href: '/map', icon: MapIcon },
    // Administrators and field supervisors can access full reports feed and observers roster
    ...(isAdmin || isSupervisor ? [
      { name: 'Reports', href: '/reports', icon: FileText },
      { name: 'Observers', href: '/observers', icon: Users }
    ] : []),
    { name: 'Report', href: '/report', icon: FilePlus },
    { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
  ];

  const handleSignOut = () => {
    logoutUser();
  };

  const getRoleLabel = () => {
    if (isAdmin) return 'Administrator';
    if (isSupervisor) return 'Field Supervisor';
    return 'Field Observer';
  };

  const getRoleBadgeClasses = () => {
    if (isAdmin) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (isSupervisor) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-emerald-100/70 text-emerald-800 border-emerald-200';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Accessible Skip Link for Keyboard and Screen Reader Users */}
      <a 
        href="#main-content" 
        className="sr-only-focusable z-50 p-4 bg-[#141A56] text-white font-bold rounded-xl shadow-2xl fixed top-4 left-4 focus:ring-4 focus:ring-emerald-400"
      >
        Skip to main content
      </a>

      {/* Sidebar for Desktop */}
      <aside 
        aria-label="Desktop Sidebar Navigation"
        className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 sticky top-0 h-screen"
      >
        <div className="p-6 flex items-center gap-3 border-b border-gray-100">
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
            <Vote className="text-white w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-none">iVote</h1>
            <p className="text-xs text-gray-500 mt-1">Election Monitor</p>
          </div>
        </div>

        <nav aria-label="Main Navigation" className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${
                  isActive 
                    ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-600' : ''}`} aria-hidden="true" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-2xl p-4 mb-4 space-y-2">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Account</p>
              <p className="text-sm font-medium text-gray-900 mt-1 truncate">{user?.displayName}</p>
              <p className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-block mt-1 uppercase tracking-wider border ${getRoleBadgeClasses()}`}>
                {getRoleLabel()}
              </p>
            </div>
            <div className="pt-2 border-t border-gray-200/60">
              <InstallPWAButton className="w-full justify-center" />
            </div>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Sign out of your account"
            className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium text-sm min-h-[44px] cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Nav Header */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Vote className="text-emerald-600 w-6 h-6" aria-hidden="true" />
          <span className="font-bold text-gray-900 tracking-tight text-lg">iVote</span>
        </div>
        <div className="flex items-center gap-2">
          <DangerButton variant="compact" />
          <NotificationCenter />
          <button 
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            className="p-2.5 text-gray-700 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed inset-0 z-40 pt-20 bg-white overflow-y-auto"
          >
            <nav aria-label="Mobile Main Navigation" className="p-6 space-y-2">
              <div className="pb-2">
                <InstallPWAButton className="w-full justify-center py-3 text-sm min-h-[44px]" />
              </div>
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-4 p-4 text-base font-semibold rounded-2xl min-h-[48px] transition-colors ${
                      isActive ? 'bg-emerald-50 text-emerald-800' : 'text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="w-6 h-6 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setShowGuidelinesModal(true);
                }}
                className="flex items-center gap-4 p-4 text-base font-semibold text-emerald-800 hover:bg-emerald-50 rounded-2xl w-full text-left cursor-pointer min-h-[48px]"
              >
                <BookOpen className="w-6 h-6 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>Code of Conduct & Guidelines</span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-4 p-4 text-base font-semibold text-red-600 hover:bg-red-50 rounded-2xl w-full text-left cursor-pointer min-h-[48px]"
              >
                <LogOut className="w-6 h-6 shrink-0" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main id="main-content" role="main" tabIndex={-1} className="flex-1 min-h-screen outline-none">
        <header className="hidden md:flex justify-between items-center p-6 border-b border-gray-50 bg-white/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-4 px-4">
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  {isOnline ? (
                    <>
                      <Wifi className="w-3 h-3 text-emerald-500" />
                      Live Connection
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-red-500" />
                      Offline Mode
                    </>
                  )}
                </span>
             </div>
             {isSyncing && (
               <motion.span 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1"
               >
                 <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                 Syncing
               </motion.span>
             )}
          </div>
          <div className="flex items-center gap-3">
             <button
               onClick={() => setShowGuidelinesModal(true)}
               className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200/80 transition-all cursor-pointer"
             >
               <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
               <span>Code of Conduct</span>
             </button>
             <ElectionScopeSelector compact />
             <PushNotificationPrompt compact />
             <InstallPWAButton />
             <DangerButton variant="header" />
             <div className="h-8 w-px bg-gray-100 mx-1" />
             <NotificationCenter />
          </div>
        </header>

        <ActiveSOSBanner />
        <OfflineSyncBanner />
        <FirstTimeLocationPrompt />
        <InstallPWABanner />

        <div className="p-6 md:p-10 lg:p-12 max-w-7xl mx-auto w-full space-y-6">
          <ActiveDirectivesBanner />
          <Outlet />
        </div>
      </main>

      {/* Observer Floating Quick Action Button (Speed Dial FAB) */}
      <ObserverFAB />

      {/* Modal Overlay for Observer Guidelines & Onboarding */}
      <AnimatePresence>
        {showGuidelinesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-4xl"
            >
              <ObserverOnboarding 
                onCancel={() => setShowGuidelinesModal(false)}
                onComplete={() => setShowGuidelinesModal(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
