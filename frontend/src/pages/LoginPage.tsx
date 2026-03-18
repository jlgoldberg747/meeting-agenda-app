import { useState, FormEvent } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) { setError(error); return; }
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-navy tracking-tight">
            Meeting<span className="text-teal-dk">Agenda</span>
          </h1>
          <p className="text-muted text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card-lg p-6 relative overflow-hidden card-accent">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors"
              />
            </div>
            <div>
              <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors"
              />
            </div>

            {error && (
              <div className="text-[11px] text-coral bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-[11px] text-muted mt-4">
            Don't have an account?{' '}
            <Link to="/signup" className="text-teal-dk font-bold hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
