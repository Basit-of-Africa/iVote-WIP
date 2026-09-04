import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Vote, ShieldCheck, Globe, ArrowLeft, AlertTriangle, Copy, Check, ExternalLink, Mail, UserCheck, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { authenticateAndAuthorizeUser, PRIMARY_ADMIN_EMAIL } from '../lib/observerAuth';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [directEmail, setDirectEmail] = useState(PRIMARY_ADMIN_EMAIL);
  const [showDirectLogin, setShowDirectLogin] = useState(false);

  const { authError, clearAuthError, user, loginDirect } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleCopyDomain = async (domainToCopy: string) => {
    try {
      await navigator.clipboard.writeText(domainToCopy);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    } catch (e) {
      console.warn('Clipboard copy notice:', e);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setUnauthorizedDomain(null);
    clearAuthError();

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const { user: firebaseUser } = result;

      // Authorize that user's email is in the imported roster or admin
      await authenticateAndAuthorizeUser(firebaseUser);
      navigate('/dashboard');
    } catch (err: any) {
      const errorCode = err?.code || '';
      const errorMessage = err?.message || String(err);
      const isDomainError = 
        errorCode === 'auth/unauthorized-domain' || 
        errorMessage.includes('unauthorized-domain') || 
        errorMessage.includes('auth/unauthorized-domain');

      if (isDomainError) {
        const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        console.warn(`[Firebase Auth] Domain '${currentHostname}' is not listed in Firebase Authorized Domains. Providing domain resolution options and direct observer login.`);
        setUnauthorizedDomain(currentHostname);
        setError(null);
      } else {
        console.warn("Login authorization notice:", err);
        setError(errorMessage || 'Access Denied: Only imported observer emails can log in.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDirectLogin = async (emailToUse: string) => {
    if (!emailToUse.trim()) return;
    setLoading(true);
    setError(null);
    clearAuthError();

    try {
      await loginDirect(emailToUse.trim());
      navigate('/dashboard');
    } catch (err: any) {
      console.warn('Direct login notice:', err);
      setError(err?.message || 'Failed to sign in with provided email');
    } finally {
      setLoading(false);
    }
  };

  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side: branding/imagery */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-emerald-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540910419892-f39a62a1bf3d?q=80&w=2070&auto=format&fit=crop')] opacity-10 bg-cover bg-center" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Vote className="w-8 h-8 text-emerald-400" />
            <span className="text-2xl font-bold tracking-tight">iVote.</span>
          </div>
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-800/80 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all border border-emerald-700"
          >
            <Globe className="w-4 h-4 text-emerald-400" /> Public Live Feed
          </Link>
        </div>
        
        <div className="relative z-10">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold leading-tight font-serif"
          >
            Protecting the integrity of every single vote.
          </motion.h2>
          <p className="mt-6 text-xl text-emerald-100/70 font-light max-w-lg">
            A secure, real-time election monitoring system designed for accountability, transparency, and civil impact.
          </p>
        </div>

        <div className="relative z-10 flex gap-12 text-emerald-100/50 text-sm font-medium">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Secure Auth
          </div>
          <div className="flex items-center gap-2">
            <Vote className="w-4 h-4" /> Audit Trails
          </div>
        </div>
      </div>

      {/* Right side: login form */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-8 bg-gray-50 relative">
        <div className="absolute top-6 left-6 lg:hidden">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-emerald-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Public Feed
          </Link>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg bg-white p-8 sm:p-10 rounded-[32px] shadow-sm border border-gray-100"
        >
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-serif">Observer Sign In</h1>
            <p className="text-gray-500 mt-2 text-sm font-medium">Access your election reporting workspace</p>
          </div>

          {/* Dedicated Firebase Authorized Domain Notice Banner */}
          <AnimatePresence>
            {unauthorizedDomain && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-5 bg-amber-50/90 border-2 border-amber-300/80 rounded-2xl text-amber-950 text-xs space-y-3"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm text-amber-900">Firebase Authorized Domain Notice</p>
                    <p className="text-amber-800/90 mt-0.5 leading-relaxed">
                      Google Sign-In popup was prevented because this container&apos;s domain has not been added to your Firebase project&apos;s <strong>Authorized domains</strong> list.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="font-bold text-[11px] text-amber-900 uppercase tracking-wider">Current Host Domain:</span>
                  <div className="flex items-center gap-2 bg-white/90 border border-amber-200 rounded-xl p-2 font-mono text-[11px] text-gray-800">
                    <span className="flex-1 truncate select-all">{unauthorizedDomain}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyDomain(unauthorizedDomain)}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedDomain ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-amber-900 space-y-1 bg-white/60 p-3 rounded-xl border border-amber-200/50">
                  <p className="font-semibold text-amber-950">To enable Google Popups permanently:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-amber-900/90 pl-1">
                    <li>Open your Firebase Console: <a href="https://console.firebase.google.com/project/gen-lang-client-0482227926/authentication/settings" target="_blank" rel="noreferrer" className="underline font-bold text-amber-950 inline-flex items-center gap-0.5 hover:text-emerald-700">Auth Settings <ExternalLink className="w-3 h-3 inline" /></a></li>
                    <li>Under <strong>Authorized domains</strong>, click <strong>Add domain</strong></li>
                    <li>Paste <code className="font-mono bg-amber-100/80 px-1 rounded">{unauthorizedDomain}</code> and save</li>
                  </ol>
                </div>

                <div className="pt-2 border-t border-amber-200/60 flex flex-col gap-2">
                  <p className="font-bold text-[11px] text-amber-900 uppercase tracking-wider">Instant Access (Bypass OAuth Domain Check):</p>
                  <button
                    type="button"
                    onClick={() => handleDirectLogin(PRIMARY_ADMIN_EMAIL)}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Sign In Instantly as Lead Administrator ({PRIMARY_ADMIN_EMAIL})</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div role="alert" aria-live="assertive" className="mb-6 p-4 bg-red-50 text-red-800 text-xs font-medium rounded-2xl border border-red-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-bold text-red-900">Observer Sign In Notice</p>
                <p className="leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-3.5 mb-6 text-xs text-emerald-900 leading-relaxed">
            <p className="font-bold mb-0.5 flex items-center gap-1.5 text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" /> Authorized Observer Access
            </p>
            Sign in with your Google account or authorized observer email ({PRIMARY_ADMIN_EMAIL} for Lead Administrator).
          </div>

          <div className="space-y-4">
            {/* Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              aria-label="Sign in with your Google account"
              className="w-full flex items-center justify-center gap-4 bg-white border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/10 text-gray-800 font-semibold py-3.5 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 group min-h-[48px] cursor-pointer shadow-xs"
            >
              <img src="https://www.google.com/favicon.ico" alt="" aria-hidden="true" className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
              <span>{loading ? 'Verifying Authorization...' : 'Continue with Google SSO'}</span>
            </button>

            {/* Alternative Direct Sign In Section */}
            <div className="pt-2">
              <div className="flex items-center gap-3 text-gray-400 text-[10px] font-bold uppercase tracking-widest my-3">
                <div className="h-px flex-1 bg-gray-200" />
                Or Sign In with Observer Credentials
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {!showDirectLogin ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleDirectLogin(PRIMARY_ADMIN_EMAIL)}
                    disabled={loading}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-emerald-50/60 border border-gray-200 hover:border-emerald-300 rounded-xl transition-all text-left text-xs group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 group-hover:text-emerald-900">Lead Administrator</p>
                        <p className="text-[11px] text-gray-500">{PRIMARY_ADMIN_EMAIL}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDirectLogin(true)}
                    className="w-full text-center text-xs font-semibold text-emerald-700 hover:text-emerald-800 py-1.5 hover:underline cursor-pointer"
                  >
                    Enter a specific observer email &rarr;
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleDirectLogin(directEmail);
                  }}
                  className="space-y-3 bg-gray-50 p-3.5 rounded-2xl border border-gray-200"
                >
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                    Authorized Observer Email
                  </label>
                  <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-3 py-2 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={directEmail}
                      onChange={(e) => setDirectEmail(e.target.value)}
                      placeholder="observer@electionwatch.ng"
                      className="w-full bg-transparent text-xs text-gray-900 outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading || !directEmail.trim()}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {loading ? 'Authenticating...' : 'Sign In with Email'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDirectLogin(false)}
                      className="py-2 px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            <Link
              to="/"
              aria-label="Go to the public live election feed without signing in"
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-bold py-3 px-6 rounded-2xl transition-all text-xs border border-gray-200 min-h-[44px]"
            >
              <Globe className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              <span>View Public Live Dashboard (No Login Required)</span>
            </Link>
          </div>
        </motion.div>
        
        <div className="mt-8 text-center md:hidden flex items-center gap-2 text-emerald-700 font-bold">
           <Vote className="w-5 h-5" /> iVote
        </div>
      </div>
    </div>
  );
}

