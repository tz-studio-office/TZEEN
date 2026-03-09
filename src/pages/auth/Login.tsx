import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { BookOpen, Eye, EyeOff, GraduationCap, Shield, ArrowLeft } from 'lucide-react';

type LoginMode = 'student' | 'staff';
type View = 'login' | 'forgot';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<LoginMode>('student');
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccess('Password reset email sent. Check your inbox.');
    }
  }

  return (
    <div className="min-h-screen bg-sand-50 flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://images.pexels.com/photos/4778611/pexels-photo-4778611.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750"
          alt="Study"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-sand-900/70 to-sand-900/30" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <h2 className="font-display text-4xl text-white leading-tight mb-4">
            Your English journey<br />starts here.
          </h2>
          <p className="text-sand-200 text-lg max-w-md leading-relaxed">
            T-Z Studio provides personalized English coaching to help you achieve your goals with confidence.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-accent-50 rounded-2xl mb-5 border border-accent-200">
              <BookOpen className="w-7 h-7 text-accent-600" />
            </div>
            <h1 className="font-display text-3xl text-sand-900 tracking-tight">TZeen</h1>
            <p className="text-sand-500 mt-2 text-sm">English Coaching Platform</p>
          </div>

          <div className="flex gap-2 mb-8">
            <button
              onClick={() => { setMode('student'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                mode === 'student'
                  ? 'bg-accent-50 border border-accent-300 text-accent-700 shadow-sm'
                  : 'bg-white border border-sand-200 text-sand-500 hover:text-sand-700 hover:border-sand-300'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Student
            </button>
            <button
              onClick={() => { setMode('staff'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                mode === 'staff'
                  ? 'bg-warm-100 border border-warm-400 text-warm-800 shadow-sm'
                  : 'bg-white border border-sand-200 text-sand-500 hover:text-sand-700 hover:border-sand-300'
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin / Coach
            </button>
          </div>

          <div className="bg-white border border-sand-200 rounded-2xl p-8 shadow-sm">
            {view === 'forgot' ? (
              <>
                <button
                  onClick={() => { setView('login'); setError(''); setSuccess(''); }}
                  className="flex items-center gap-1.5 text-sand-500 hover:text-sand-800 text-sm mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </button>
                <h2 className="text-xl font-semibold text-sand-900 mb-1">Reset Password</h2>
                <p className="text-sm text-sand-500 mb-6">
                  Enter your email and we'll send you a password reset link.
                </p>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-xl mb-6 text-sm">
                    {success}
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-sand-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-300 transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-sand-900 hover:bg-sand-800 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-sand-900 mb-1">
                  {mode === 'student' ? 'Student Sign In' : 'Admin / Coach Sign In'}
                </h2>
                <p className="text-sm text-sand-500 mb-6">
                  {mode === 'student'
                    ? 'Sign in to access your learning dashboard'
                    : 'Sign in to manage students and coaching'}
                </p>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-sand-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-300 transition-all"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-sand-700">Password</label>
                      <button
                        type="button"
                        onClick={() => { setView('forgot'); setError(''); }}
                        className="text-xs text-accent-600 hover:text-accent-500 font-medium transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-300 transition-all pr-12"
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sand-400 hover:text-sand-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-3 font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                      mode === 'student'
                        ? 'bg-accent-600 hover:bg-accent-500 text-white'
                        : 'bg-warm-700 hover:bg-warm-600 text-white'
                    }`}
                  >
                    {loading ? 'Signing in...' : 'Sign in'}
                  </button>
                </form>

                {mode === 'student' && (
                  <p className="text-center text-sand-500 mt-6 text-sm">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-accent-600 hover:text-accent-500 font-medium transition-colors">
                      Create one
                    </Link>
                  </p>
                )}

                {mode === 'staff' && (
                  <p className="text-center text-sand-400 mt-6 text-xs">
                    Admin and Coach accounts are created by your organization administrator.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
