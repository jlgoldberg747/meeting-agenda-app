import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest border-[1.5px] transition-all duration-200 ${
          isActive
            ? 'text-teal-dk bg-[var(--teal-tint-bg)] border-[var(--teal-tint-bdr)]'
            : 'text-muted border-transparent hover:text-slate hover:bg-srf-alt'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-srf border-b-[1.5px] border-bdr shadow-card h-[52px] flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="font-black text-navy tracking-tight text-sm">
            Meeting<span className="text-teal-dk">Agenda</span>
          </span>
          <div className="w-px h-6 bg-bdr mx-1" />
        </div>

        <div className="flex gap-1">
          <NavItem to="/dashboard" label="Dashboard" />
          <NavItem to="/templates" label="Templates" />
          <NavItem to="/meetings" label="Meetings" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted font-bold hidden sm:block truncate max-w-[140px]">
            {user?.email}
          </span>
          <Link
            to="/settings"
            className="px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider border-[1.5px] border-transparent text-muted hover:text-slate hover:bg-srf-alt transition-all duration-200"
            title="Settings"
          >
            ⚙
          </Link>
          <button
            onClick={handleSignOut}
            className="border-[1.5px] border-coral text-coral text-[9px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full hover:bg-[var(--coral-hover)] transition-all duration-200"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-[1300px] mx-auto px-4 py-5 pb-16">
        <Outlet />
      </main>
    </div>
  );
}
