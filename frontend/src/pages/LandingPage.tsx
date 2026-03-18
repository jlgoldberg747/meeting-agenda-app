import { Link } from 'react-router-dom';

const features = [
  {
    icon: '🗂',
    title: 'Structured Agendas',
    desc: 'Design every session with purpose — set formats, objectives, and timing before the room fills up.',
  },
  {
    icon: '⏱',
    title: 'Live Facilitation',
    desc: 'Keep the flow with live timers, gentle chimes, and real-time drift tracking. Stay present, stay on time.',
  },
  {
    icon: '📋',
    title: 'Reusable Templates',
    desc: 'Capture your best meeting designs as templates. Every workshop starts from your strongest foundation.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F4F8F8] text-navy font-sans overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <span className="font-black tracking-tight text-base text-navy">
          Meeting<span className="text-teal-dk">Agenda</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-[11px] font-extrabold uppercase tracking-widest text-muted hover:text-slate transition-colors px-3 py-1.5"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="text-[11px] font-extrabold uppercase tracking-widest px-4 py-2 rounded-full bg-gradient-to-r from-teal-dk to-teal-br text-white shadow-teal hover:-translate-y-0.5 transition-all"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto text-center px-6 pt-16 pb-20">
        {/* Ambient glow */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none opacity-30"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(8,179,195,0.18) 0%, transparent 70%)',
            top: '80px',
            zIndex: 0,
          }}
        />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-teal-dk bg-[rgba(8,179,195,0.1)] border border-[rgba(8,179,195,0.25)] rounded-full px-3 py-1.5 mb-8 animate-fade-in-slow">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-dk inline-block" />
            Collaborative Strategic Planning
          </div>

          <h1
            className="text-[clamp(2.4rem,6vw,3.6rem)] font-black leading-[1.1] tracking-tight text-navy mb-6 animate-fade-in-up"
            style={{ letterSpacing: '-0.02em' }}
          >
            Run workshops<br />
            <span style={{ color: 'var(--teal-dk)' }}>that flow.</span>
          </h1>

          <p className="text-base text-slate leading-relaxed max-w-xl mx-auto mb-10 animate-fade-in-up animation-delay-200">
            Design purposeful agendas, facilitate live sessions with gentle guidance,
            and build a library of your best meeting formats — so every gathering
            becomes a moment of clarity.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap animate-fade-in-up animation-delay-400">
            <Link
              to="/signup"
              className="px-7 py-3 rounded-full font-extrabold text-[12px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-1 hover:shadow-[0_6px_20px_rgba(43,188,200,0.4)] transition-all"
            >
              Start for free
            </Link>
            <Link
              to="/login"
              className="px-7 py-3 rounded-full font-extrabold text-[12px] uppercase tracking-wider text-slate border-[1.5px] border-bdr hover:border-teal-dk hover:text-teal-dk transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-bdr to-transparent" />
      </div>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <p className="text-center text-[9px] font-extrabold uppercase tracking-widest text-muted mb-12 animate-fade-in-slow">
          Everything you need to facilitate with confidence
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`bg-white rounded-[18px] border-[1.5px] border-bdr p-7 shadow-card hover:shadow-card-lg hover:-translate-y-1 transition-all animate-fade-in-up animation-delay-${(i + 1) * 200}`}
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-black text-navy text-[15px] mb-2 leading-snug">{f.title}</h3>
              <p className="text-[12px] text-slate leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div
          className="rounded-[24px] p-10 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0D1F3C 0%, #1A3050 60%, #0D2A3A 100%)',
          }}
        >
          {/* Subtle teal glow inside card */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 70% 30%, rgba(43,188,200,0.12) 0%, transparent 60%)',
            }}
          />
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-white mb-3 leading-tight">
              Your next great workshop<br />starts here.
            </h2>
            <p className="text-[13px] text-[rgba(255,255,255,0.65)] leading-relaxed mb-8 max-w-md mx-auto">
              Join teams who plan with intention. Create your first template in minutes.
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-extrabold text-[12px] uppercase tracking-wider text-navy bg-white hover:bg-[#F0F4F8] hover:-translate-y-0.5 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
            >
              Create free account →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-bdr py-8 text-center">
        <span className="font-black text-navy tracking-tight text-sm">
          Meeting<span className="text-teal-dk">Agenda</span>
        </span>
        <p className="text-[10px] text-muted mt-2">
          Collaborative sessions, beautifully orchestrated.
        </p>
      </footer>
    </div>
  );
}
