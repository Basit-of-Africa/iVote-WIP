import React, { useState, useEffect } from 'react';
import { Download, CheckCircle2, Smartphone, Monitor, Share, PlusSquare, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallPWABanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // 1. Check if already installed / running in standalone mode
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // 2. Check for iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    // 3. Listen for browser install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      // Check if user previously dismissed
      const dismissed = localStorage.getItem('ivote_pwa_dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setShowBanner(false);
      toast.success('🎉 iVote Election Monitor app installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          toast.success('Installation started!');
          setShowBanner(false);
        } else {
          toast.info('Installation deferred.');
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      toast.info('PWA installation is supported via your browser menu (Install / Add to Home Screen).');
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('ivote_pwa_dismissed', 'true');
  };

  if (isStandalone) {
    return null; // App is running as installed PWA
  }

  return (
    <>
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[90] bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white p-5 rounded-3xl border border-emerald-500/40 shadow-2xl backdrop-blur-xl"
          >
            <button
              onClick={handleDismiss}
              className="absolute top-3.5 right-3.5 p-1 text-slate-400 hover:text-white bg-slate-800/60 rounded-full transition-colors"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-600/30">
                <Smartphone className="w-6 h-6" />
              </div>

              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Install Web App</span>
                </div>
                <h4 className="text-base font-bold font-serif text-white mt-0.5 leading-snug">
                  Install iVote Election Monitor
                </h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Install for offline field reporting, instant SOS access, and zero-latency performance.
                </p>

                <div className="flex items-center gap-2.5 mt-4">
                  <button
                    onClick={handleInstallClick}
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install Now</span>
                  </button>

                  <button
                    onClick={handleDismiss}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                  >
                    Not Now
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Instructions Modal */}
      <AnimatePresence>
        {showIosGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 text-white p-6 rounded-3xl max-w-sm w-full border border-slate-700 shadow-2xl relative"
            >
              <button
                onClick={() => setShowIosGuide(false)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white bg-slate-800 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold font-serif">Install on iOS (Safari)</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  To install iVote on your iPhone or iPad:
                </p>

                <div className="bg-slate-800/80 p-4 rounded-2xl text-left space-y-3 text-xs text-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">1</span>
                    <span>Tap the <strong>Share</strong> button <Share className="w-3.5 h-3.5 inline text-emerald-400" /> in Safari navigation bar.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">2</span>
                    <span>Scroll down and select <strong>"Add to Home Screen"</strong> <PlusSquare className="w-3.5 h-3.5 inline text-emerald-400" />.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">3</span>
                    <span>Tap <strong>Add</strong> at top right to launch as a standalone app!</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowIosGuide(false)}
                  className="w-full py-2.5 bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl mt-2"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export function InstallPWAButton({ className = '' }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    
    setIsStandalone(isStandaloneMode);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast.success('iVote App installed!');
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      toast.info('iOS: Tap Share button in Safari & select "Add to Home Screen"');
    } else if (isStandalone) {
      toast.success('iVote is already running as an installed PWA!');
    } else {
      toast.info('App installation is available from your browser menu ("Install App" / "Add to Home Screen").');
    }
  };

  if (isStandalone) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>App Installed</span>
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold uppercase tracking-wider rounded-2xl shadow-md shadow-emerald-900/20 active:scale-95 transition-all cursor-pointer ${className}`}
      title="Install iVote Web App for offline field use"
    >
      <Download className="w-4 h-4 text-emerald-200 animate-bounce" />
      <span>Install PWA</span>
    </button>
  );
}
