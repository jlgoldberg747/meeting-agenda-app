import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Meeting } from '../types';
import { calcSchedule } from '../types';

function StatusBadge({ status }: { status: Meeting['status'] }) {
  const map = {
    PLANNED: { label: 'Planned', cls: 'bg-[rgba(43,188,200,0.1)] text-teal-dk' },
    IN_PROGRESS: { label: 'In Progress', cls: 'bg-[rgba(34,197,94,0.1)] text-success pulse-btn' },
    COMPLETED: { label: 'Completed', cls: 'bg-srf-alt text-muted' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

function MeetingCard({ meeting, onDelete }: { meeting: Meeting; onDelete: () => void }) {
  const dateStr = new Date(meeting.date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
  const hasAgenda = meeting.items.length > 0;
  const scheduled = hasAgenda ? calcSchedule(meeting.items, meeting.start_time) : [];
  const totalMins = meeting.items.reduce((s, i) => s + i.duration_minutes, 0);
  const lastItem = scheduled[scheduled.length - 1];

  return (
    <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card overflow-hidden hover:shadow-card-lg hover:-translate-y-0.5 transition-all">
      <div className="h-[3px] bg-gradient-to-r from-teal-dk to-teal-br" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h3 className="font-extrabold text-navy text-[14px] truncate">{meeting.title}</h3>
            {meeting.subtitle && <p className="text-muted text-[11px]">{meeting.subtitle}</p>}
          </div>
          <StatusBadge status={meeting.status} />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted mb-3">
          <span>📅 {dateStr}</span>
          <span>🕐 {meeting.start_time}{lastItem ? ` – ${lastItem.sched_end}` : ''}</span>
          {meeting.location && <span>📍 {meeting.location}</span>}
          {meeting.facilitator && <span>👤 {meeting.facilitator}</span>}
        </div>

        <div className="flex items-center gap-2 mb-4">
          {hasAgenda ? (
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[rgba(43,188,200,0.1)] text-teal-dk">
              {meeting.items.length} sessions · {Math.floor(totalMins / 60)}h{totalMins % 60 ? ` ${totalMins % 60}m` : ''}
            </span>
          ) : (
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-srf-alt text-muted">
              No agenda yet
            </span>
          )}
          {(meeting.participants?.length ?? 0) > 0 && (
            <span className="text-[9px] text-muted">{meeting.participants!.length} participants</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(meeting.status === 'PLANNED' || meeting.status === 'IN_PROGRESS') && (
            <>
              <Link
                to={`/meetings/${meeting.id}/live`}
                className="px-3 py-1.5 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all"
              >
                {meeting.status === 'IN_PROGRESS' ? '▶ Continue' : '▶ Start Meeting'}
              </Link>
              <Link
                to={`/meetings/${meeting.id}/edit`}
                className="px-3 py-1.5 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-teal-dk border-[1.5px] border-[rgba(43,188,200,0.3)] bg-[rgba(43,188,200,0.08)] hover:bg-teal hover:text-white transition-all"
              >
                Edit
              </Link>
            </>
          )}
          <Link
            to={`/meetings/${meeting.id}`}
            className="px-3 py-1.5 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-muted border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all"
          >
            View
          </Link>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-coral border-[1.5px] border-coral hover:bg-[rgba(239,68,68,0.06)] transition-all ml-auto"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MeetingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'schedule';
  const qc = useQueryClient();

  const { data: upcoming = [], isLoading: upLoading } = useQuery({
    queryKey: ['meetings-upcoming'],
    queryFn: api.meetings.upcoming,
    enabled: tab === 'schedule',
  });

  const { data: archive = [], isLoading: archLoading } = useQuery({
    queryKey: ['meetings-archive'],
    queryFn: api.meetings.archive,
    enabled: tab === 'archive',
  });

  const deleteMutation = useMutation({
    mutationFn: api.meetings.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings-upcoming'] });
      qc.invalidateQueries({ queryKey: ['meetings-archive'] });
    },
  });

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Delete meeting "${title}"? This cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  const meetings = tab === 'archive' ? archive : upcoming;
  const isLoading = tab === 'archive' ? archLoading : upLoading;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5 relative overflow-hidden card-accent">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-navy">Meetings</h1>
            <p className="text-slate text-sm mt-0.5">
              {tab === 'schedule' ? `${upcoming.length} upcoming` : `${archive.length} completed`}
            </p>
          </div>
          <Link
            to="/meetings/new"
            className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all"
          >
            + New Meeting
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {(['schedule', 'archive'] as const).map(t => (
            <button
              key={t}
              onClick={() => setSearchParams({ tab: t })}
              className={`px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border-[1.5px] transition-all ${
                tab === t
                  ? 'text-teal-dk bg-[rgba(43,188,200,0.08)] border-[rgba(43,188,200,0.3)]'
                  : 'text-muted border-transparent hover:text-slate hover:bg-srf-alt'
              }`}
            >
              {t === 'schedule' ? 'Upcoming' : 'Archive'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-10 text-muted text-sm animate-pulse">Loading…</div>
      )}

      {!isLoading && meetings.length === 0 && (
        <div className="bg-srf border-[1.5px] border-dashed border-bdr rounded-card p-10 text-center">
          <div className="text-4xl opacity-20 mb-3">
            {tab === 'schedule' ? '📅' : '🗄'}
          </div>
          <p className="text-slate font-bold">
            {tab === 'schedule' ? 'No upcoming meetings' : 'No completed meetings yet'}
          </p>
          {tab === 'schedule' && (
            <Link
              to="/meetings/new"
              className="inline-block mt-4 px-5 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all"
            >
              Schedule a Meeting
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {meetings.map(m => (
          <MeetingCard
            key={m.id}
            meeting={m}
            onDelete={() => handleDelete(m.id, m.title)}
          />
        ))}
      </div>
    </div>
  );
}
