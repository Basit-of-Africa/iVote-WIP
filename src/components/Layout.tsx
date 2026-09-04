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
  ShieldCheck,
  Building2,
  Camera,
  Bell,
  FileCheck,
  PlusCircle,
  Radio
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

  // Grouped Navigation Sections aligned with Vote Monitor principles
  const navigationSections = [
    {
      title: 'Operations',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Election Rounds', href: '/elections', icon: Vote },
        { name: 'Polling Stations', href: '/polling-stations', icon: Building2 },
        { name: 'Incident Map', href: '/map', icon: MapIcon },
      ]
    },
    {
      title: 'Reporting & Evidence',
      items: [
        { name: 'Reports', href: '/reports', icon: FileText },
        { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
        { name: 'Forms', href: '/forms', icon: FileCheck },
        { name: 'Evidence', href: '/evidence', icon: Camera },
      ]
    },
    {
      title: 'Governance',
      items: [
        { name: 'Observers', href: '/observers', icon: Users },
        { name: 'Notifications', href: '/notifications', icon: Bell },
        ...(isAdmin || isSupervisor ? [
          { name: 'Administration', href: '/admin', icon: ShieldCheck }
        ] : [])
      ]
    }
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
        className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 sticky top-0 h-screen shrink-0"
      >
        <div className="p-5 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-xs">
              <Vote className="text-white w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-none font-serif text-base">iVote</h1>
              <p className="text-[11px] text-gray-500 mt-0.5 font-sans">Election Monitor</p>
            </div>
          </div>
          <Link
            to="/"
            title="Public Live Feed"
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Globe className="w-4 h-4" />
          </Link>
        </div>

        {/* Primary Action Button (Submit Report) */}
        <div className="px-4 pt-4 pb-2">
          <Link
            to="/report"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors min-h-[40px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Submit Report</span>
          </Link>
        </div>

        {/* Grouped Navigation Links */}
        <nav aria-label="Main Navigation" className="flex-1 px-3 py-2 space-y-5 overflow-y-auto">
          {navigationSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 text-xs font-semibold min-h-[38px] ${
                        isActive 
                          ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/60 shadow-xs' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`} aria-hidden="true" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="bg-white rounded-xl p-3 mb-3 border border-gray-200/80 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Observer Session</p>
              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider border ${getRoleBadgeClasses()}`}>
                {getRoleLabel()}
              </span>
            </div>
            <p className="text-xs font-bold text-gray-900 truncate">{user?.displayName || user?.email}</p>
            <div className="pt-1.5 border-t border-gray-100">
              <InstallPWAButton className="w-full justify-center text-xs py-1" />
            </div>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Sign out of your account"
            className="flex items-center gap-2 w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-semibold text-xs min-h-[36px] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Nav Header */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Vote className="text-emerald-600 w-6 h-6" aria-hidden="true" />
          <span className="font-bold text-gray-900 tracking-tight text-lg font-serif">iVote</span>
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

      {/* Mobile Drawer */}
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
            <nav aria-label="Mobile Main Navigation" className="p-6 space-y-6">
              <div className="space-y-2">
                <Link
                  to="/report"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-emerald-600 text-white font-bold text-sm rounded-xl shadow-xs"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>Submit Field Report</span>
                </Link>
                <InstallPWAButton className="w-full justify-center py-2.5 text-xs min-h-[40px]" />
              </div>

              {navigationSections.map((section) => (
                <div key={section.title} className="space-y-2">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    {section.title}
                  </p>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex items-center gap-3 p-3.5 text-sm font-semibold rounded-xl min-h-[44px] transition-colors ${
                            isActive ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'text-gray-800 hover:bg-gray-50'
                          }`}
                        >
                          <item.icon className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-gray-100 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setShowGuidelinesModal(true);
                  }}
                  className="flex items-center gap-3 p-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 rounded-xl w-full text-left cursor-pointer min-h-[44px]"
                >
                  <BookOpen className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>Code of Conduct & Guidelines</span>
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-3 p-3 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl w-full text-left cursor-pointer min-h-[44px]"
                >
                  <LogOut className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </div>
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
          {/* Vote Monitor Aligned Action Nav Bar */}
          <div className="flex items-center gap-2.5">
             {/* Election Scope Selector */}
             <div className="flex items-center">
               <ElectionScopeSelector compact />
             </div>

             {/* Primary Quick Action: Submit Field Report */}
             <Link
               to="/report"
               className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer select-none"
               title="Submit New Field Observation Report"
             >
               <PlusCircle className="w-3.5 h-3.5" />
               <span className="hidden xl:inline">Submit Report</span>
             </Link>

             {/* Guidelines & Conduct */}
             <button
               type="button"
               onClick={() => setShowGuidelinesModal(true)}
               className="hidden lg:inline-flex items-center gap-1.5 h-9 px-3 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 transition-all cursor-pointer shadow-2xs"
               title="Observer Code of Conduct & Field Guidelines"
             >
               <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
               <span>Guidelines</span>
             </button>

             <PushNotificationPrompt compact />
             <InstallPWAButton />

             {/* Emergency / Threat Alert */}
             <DangerButton variant="header" className="!h-9 !py-0 !rounded-xl text-xs" />

             {/* Subtle Divider */}
             <div className="h-5 w-px bg-gray-200 mx-0.5" />

             {/* Notification Center */}
             <NotificationCenter />

             {/* Observer Profile Pill */}
             {user && (
               <div className="hidden xl:flex items-center gap-2 pl-1.5 py-1 pr-2.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
                 <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
                   {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                 </div>
                 <div className="flex flex-col text-left leading-none">
                   <span className="text-[11px] font-bold text-gray-800 truncate max-w-[110px]">
                     {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
                   </span>
                   <span className="text-[9px] font-semibold text-gray-400 capitalize mt-0.5">
                     {user.role || 'Observer'}
                   </span>
                 </div>
               </div>
             )}
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
