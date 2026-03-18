import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { Meeting } from '../types';

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: color || 'var(--teal-br)' }} />
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted mb-1">{label}</div>
      <div className="text-3xl font-black text-navy font-mono">{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function MeetingRow({ meeting }: { meeting: Meeting }) {
  const hasAgenda = meeting.items.length > 0;
  const totalMins = meeting.items.reduce((s, i) => s + i.duration_minutes, 0);
  const dateStr = new Date(meeting.date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short'
  });

  return (
    <Link
      to={`/meetings/${meeting.id}`}
      className="flex items-center justify-between px-4 py-3 border-b border-srf-alt hover:bg-[var(--teal-glow)] transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-center min-w-[48px]">
          <div className="font-mono text-[11px] text-muted font-bold">{dateStr}</div>
          <div className="font-mono text-[11px] text-muted">{meeting.start_time}</div>
        </div>
        <div className="min-w-0">
          <div className="font-extrabold text-navy text-[13px] truncate">{meeting.title}</div>
          {meeting.location && <div className="text-xs text-muted">{meeting.location}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${hasAgenda ? 'bg-[rgba(43,188,200,0.1)] text-teal-dk' : 'bg-srf-alt text-muted'}`}>
          {hasAgenda ? `${meeting.items.length} items · ${totalMins}m` : 'No agenda'}
        </span>
        <svg className="w-4 h-4 text-muted group-hover:text-teal-dk transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: upcoming = [] } = useQuery({ queryKey: ['meetings-upcoming'], queryFn: api.meetings.upcoming });
  const { data: templates = [] } = useQuery({ queryKey: ['templates'], queryFn: api.templates.list });
  const { data: archive = [] } = useQuery({ queryKey: ['meetings-archive'], queryFn: api.meetings.archive });

  const name = (user?.user_metadata?.name || user?.email?.split('@')[0] || 'there');

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5 relative overflow-hidden card-accent">
        <h1 className="text-xl font-black text-navy">
          Hello, <span className="text-teal-dk">{name}</span>
        </h1>
        <p className="text-slate text-sm mt-1">Here's what's on your agenda.</p>

        {/* Quick actions */}
        <div className="flex gap-2 mt-4 flex-wrap">
          <Link
            to="/meetings/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-extrabold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all"
          >
            <span>+</span> New Meeting
          </Link>
          <Link
            to="/templates/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-extrabold text-xs uppercase tracking-wider text-navy border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all"
          >
            <span>+</span> New Template
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Upcoming" value={upcoming.length} sub="meetings scheduled" color="#08B3C3" />
        <StatCard label="Templates" value={templates.length} sub="reusable agendas" color="#9333EA" />
        <StatCard label="Completed" value={archive.length} sub="past meetings" color="#22C55E" />
        <StatCard
          label="This Week"
          value={upcoming.filter(m => {
            const d = new Date(m.date);
            const now = new Date();
            const weekEnd = new Date(now);
            weekEnd.setDate(now.getDate() + 7);
            return d <= weekEnd;
          }).length}
          sub="in the next 7 days"
          color="#F97316"
        />
      </div>

      {/* Upcoming meetings */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bdr">
          <h2 className="font-extrabold text-navy text-sm">Upcoming Meetings</h2>
          <Link to="/meetings" className="text-xs text-teal-dk font-bold hover:underline">
            View all →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-3xl opacity-20 mb-2">📅</div>
            <p className="text-muted text-sm">No upcoming meetings</p>
            <Link to="/meetings/new" className="text-teal-dk text-xs font-bold mt-1 inline-block hover:underline">
              Schedule one →
            </Link>
          </div>
        ) : (
          <div>
            {upcoming.slice(0, 5).map(m => <MeetingRow key={m.id} meeting={m} />)}
          </div>
        )}
      </div>

      {/* Recent archive */}
      {archive.length > 0 && (
        <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-bdr">
            <h2 className="font-extrabold text-navy text-sm">Recent Completed</h2>
            <Link to="/meetings?tab=archive" className="text-xs text-teal-dk font-bold hover:underline">
              Archive →
            </Link>
          </div>
          <div>
            {archive.slice(0, 3).map(m => <MeetingRow key={m.id} meeting={m} />)}
          </div>
        </div>
      )}
    </div>
  );
}
