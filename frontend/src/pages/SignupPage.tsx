import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError('');
    setLoading(true);
    const { error } = await signUp(email, password, name);
    setLoading(false);
    if (error) { setError(error); return; }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-xl font-black text-navy">Check your email</h2>
          <p className="text-muted text-sm mt-2 mb-6">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <Link to="/login" className="text-teal-dk font-bold text-sm hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-navy tracking-tight">
            Meeting<span className="text-teal-dk">Agenda</span>
          </h1>
          <p className="text-muted text-sm mt-1">Create your account</p>
        </div>

        <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card-lg p-6 relative overflow-hidden card-accent">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Your name"
                className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors"
              />
            </div>
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
                minLength={6}
                placeholder="Minimum 6 characters"
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
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-[11px] text-muted mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-teal-dk font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
