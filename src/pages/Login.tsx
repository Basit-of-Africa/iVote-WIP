import { useState, useEffect, FormEvent } from 'react';
import { 
  Vote, 
  ShieldCheck, 
  Globe, 
  ArrowLeft, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Lock, 
  User as UserIcon, 
  ArrowRight, 
  Sparkles,
  CheckCircle2,
  PauseCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { DEMO_ACCOUNTS, DemoUserAccount } from '../lib/observerAuth';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberSession, setRememberSession] = useState(true);

  const { authError, clearAuthError, user, loginDemo } = useAuth();
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please provide both username/email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    clearAuthError();

    try {
      await loginDemo(username.trim(), password.trim());
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Invalid username or password. Please use one of the demo accounts.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (acc: DemoUserAccount) => {
    setUsername(acc.username);
    setPassword(acc.password);
    setLoading(true);
    setError(null);
    clearAuthError();

    try {
      await loginDemo(acc.username, acc.password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Failed to login with demo credentials');
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
            A secure, real-time election monitoring system designed for accountability, transparency, and field reporting.
          </p>
        </div>

        <div className="relative z-10 flex gap-12 text-emerald-100/50 text-sm font-medium">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Demo Credentials Enabled
          </div>
          <div className="flex items-center gap-2">
            <Vote className="w-4 h-4 text-emerald-400" /> Full Role Simulation
          </div>
        </div>
      </div>

      {/* Right side: demo login form */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-10 bg-gray-50 relative overflow-y-auto">
        <div className="absolute top-6 left-6 lg:hidden">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-emerald-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Public Feed
          </Link>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg bg-white p-7 sm:p-9 rounded-[32px] shadow-sm border border-gray-100 my-4"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-full border border-emerald-200/60 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Demo Authentication Active
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-serif">Sign In to iVote</h1>
            <p className="text-gray-500 mt-1 text-xs font-medium">
              Enter your demo username and password or select a role below
            </p>
          </div>

          {error && (
            <div role="alert" aria-live="assertive" className="mb-5 p-3.5 bg-red-50 text-red-800 text-xs font-medium rounded-2xl border border-red-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5">
                <p className="font-bold text-red-900">Authentication Failed</p>
                <p className="leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Username & Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                Username or Email
              </label>
              <div className="relative flex items-center">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin, supervisor, or observer"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded-2xl text-xs text-gray-900 font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Password
                </label>
                <span className="text-[11px] text-gray-400 font-mono">Demo: password123</span>
              </div>
              <div className="relative flex items-center">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter demo password"
                  className="w-full pl-10 pr-11 py-3 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded-2xl text-xs text-gray-900 font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs py-1">
              <label className="flex items-center gap-2 text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberSession}
                  onChange={(e) => setRememberSession(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 border-gray-300"
                />
                <span>Remember session on this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl transition-all shadow-xs text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[46px]"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In as Observer / Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Accounts Selection */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Select Demo Role
              </span>
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                1-Click Sign In
              </span>
            </div>

            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const isCurrent = username.toLowerCase() === acc.username.toLowerCase();
                const roleBadgeColor = 
                  acc.role === 'admin' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                  acc.role === 'supervisor' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                  'bg-emerald-100 text-emerald-800 border-emerald-200';

                return (
                  <div
                    key={acc.username}
                    onClick={() => {
                      setUsername(acc.username);
                      setPassword(acc.password);
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isCurrent 
                        ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-400/30' 
                        : 'bg-gray-50/80 hover:bg-gray-100/70 border-gray-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-gray-900 truncate">
                          {acc.displayName.split('(')[0].trim()}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${roleBadgeColor}`}>
                          {acc.role.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-mono">
                        user: <strong className="text-gray-700">{acc.username}</strong> · pass: <strong className="text-gray-700">{acc.password}</strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickDemoLogin(acc);
                      }}
                      disabled={loading}
                      className="px-3 py-1.5 bg-white hover:bg-emerald-600 hover:text-white border border-gray-200 hover:border-emerald-600 text-gray-700 font-bold text-[11px] rounded-xl transition-all shadow-2xs shrink-0 cursor-pointer"
                    >
                      Login
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Suspended Google Login Notice */}
          <div className="mt-5 p-3.5 bg-gray-50 border border-gray-200 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img 
                  src="https://www.google.com/favicon.ico" 
                  alt="" 
                  aria-hidden="true" 
                  className="w-4 h-4 grayscale opacity-60" 
                />
                <span className="text-xs font-bold text-gray-500">Google Workspace SSO</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                <PauseCircle className="w-3 h-3" /> Temporarily Suspended
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
              Google OAuth popup authentication is temporarily paused while cloud domain verification is being completed. Please use the Demo Username and Password authentication above.
            </p>
          </div>

          {/* Public Live Feed Link */}
          <div className="mt-4">
            <Link
              to="/"
              aria-label="Go to the public live election feed without signing in"
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-bold py-2.5 px-4 rounded-xl transition-all text-xs border border-gray-200"
            >
              <Globe className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              <span>View Public Live Dashboard (No Login Required)</span>
            </Link>
          </div>
        </motion.div>
        
        <div className="mt-6 text-center md:hidden flex items-center gap-2 text-emerald-700 font-bold text-xs">
           <Vote className="w-4 h-4" /> iVote Election Monitoring
        </div>
      </div>
    </div>
  );
}
