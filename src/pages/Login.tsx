import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Vote, ShieldCheck, Globe, ArrowLeft, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { authenticateAndAuthorizeUser } from '../lib/observerAuth';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { authError, clearAuthError, user } = useAuth();
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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    clearAuthError();

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const { user: firebaseUser } = result;

      // Authorize that user's email is in the imported roster or admin
      await authenticateAndAuthorizeUser(firebaseUser);
      
      navigate('/dashboard');
    } catch (err: any) {
      console.error("Login authorization error:", err);
      setError(err.message || 'Access Denied: Only imported observer emails can log in.');
    } finally {
      setLoading(false);
    }
  };

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
      <div className="flex flex-col justify-center items-center p-8 bg-gray-50 relative">
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
          className="w-full max-w-md bg-white p-10 rounded-[32px] shadow-sm border border-gray-100"
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-serif">Observer Sign In</h1>
            <p className="text-gray-500 mt-2 text-sm font-medium">Access your election reporting workspace</p>
          </div>

          {error && (
            <div role="alert" aria-live="assertive" className="mb-6 p-4 bg-red-50 text-red-800 text-xs font-medium rounded-2xl border border-red-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-bold text-red-900">Observer Roster Verification Failed</p>
                <p className="leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 mb-6 text-xs text-amber-900 leading-relaxed">
            <p className="font-bold mb-1 flex items-center gap-1.5 text-amber-800">
              <ShieldCheck className="w-4 h-4 text-amber-600" aria-hidden="true" /> Authorized Personnel Requirement
            </p>
            Only email addresses that have been imported into the Observer Directory (via CSV Template or Admin Registration) can log in as field observers.
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              aria-label="Sign in with your Google account"
              className="w-full flex items-center justify-center gap-4 bg-white border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/10 text-gray-800 font-semibold py-4 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 group min-h-[48px] cursor-pointer"
            >
              <img src="https://www.google.com/favicon.ico" alt="" aria-hidden="true" className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
              <span>{loading ? 'Verifying Authorization...' : 'Continue with Google'}</span>
            </button>

            <Link
              to="/"
              aria-label="Go to the public live election feed without signing in"
              className="w-full flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold py-3 px-6 rounded-2xl transition-all text-xs border border-gray-200 min-h-[44px]"
            >
              <Globe className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              <span>View Public Live Dashboard (No Login Required)</span>
            </Link>
            
            <div className="flex items-center gap-4 text-gray-400 text-[10px] font-bold uppercase tracking-widest my-6">
              <div className="h-px flex-1 bg-gray-100" />
              Imported Observer Roster Security
              <div className="h-px flex-1 bg-gray-100" />
            </div>

            <p className="text-center text-[11px] text-gray-400 leading-relaxed px-2">
              If your email is not yet registered, contact your regional election supervisor or administrator to be added to the CSV Observer roster.
            </p>
          </div>
        </motion.div>
        
        <div className="mt-8 text-center md:hidden flex items-center gap-2 text-emerald-700 font-bold">
           <Vote className="w-5 h-5" /> iVote
        </div>
      </div>
    </div>
  );
}

