import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import AgendaEditor from '../components/AgendaEditor';
import type { AgendaItemBase, MeetingFormat } from '../types';

type EditItem = Omit<AgendaItemBase, 'id'> & { id: string };

export default function NewMeetingPage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(id);

  const { data: existingMeeting } = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => api.meetings.get(id!),
    enabled: isEdit,
  });

  const { data: templateList = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: api.templates.list,
  });

  const { data: selectedTemplate } = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => api.templates.get(templateId!),
    enabled: Boolean(templateId),
  });

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [location, setLocation] = useState('');
  const [facilitator, setFacilitator] = useState('');
  const [participantsStr, setParticipantsStr] = useState('');
  const [chosenTemplate, setChosenTemplate] = useState(templateId || '');
  const [items, setItems] = useState<EditItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existingMeeting) {
      setTitle(existingMeeting.title);
      setSubtitle(existingMeeting.subtitle || '');
      setDate(existingMeeting.date);
      setStartTime(existingMeeting.start_time);
      setLocation(existingMeeting.location || '');
      setFacilitator(existingMeeting.facilitator || '');
      setParticipantsStr(existingMeeting.participants.join(', '));
      setChosenTemplate(existingMeeting.template_id || '');
      setItems(existingMeeting.items.map(i => ({ ...i })));
    }
  }, [existingMeeting]);

  // Load template items when a template is selected (only if items are empty)
  useEffect(() => {
    if (selectedTemplate && !isEdit) {
      setStartTime(selectedTemplate.start_time);
      setItems(selectedTemplate.items.map((i, idx) => ({
        ...i,
        id: `tmp-${idx}-${i.id}`,
      })));
    }
  }, [selectedTemplate, isEdit]);

  const onTemplateChange = async (tid: string) => {
    setChosenTemplate(tid);
    if (!tid) { setItems([]); return; }
    const tpl = await api.templates.get(tid);
    setStartTime(tpl.start_time);
    setItems(tpl.items.map((i, idx) => ({ ...i, id: `tmp-${idx}-${i.id}` })));
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      isEdit ? api.meetings.update(id!, data) : api.meetings.create(data),
    onSuccess: (saved: any) => {
      qc.invalidateQueries({ queryKey: ['meetings-upcoming'] });
      qc.invalidateQueries({ queryKey: ['meetings-archive'] });
      navigate(`/meetings/${saved.id}`);
    },
    onError: (err: any) => setError(err.message),
  });

  const handleSave = () => {
    if (!title.trim()) { setError('Meeting title is required'); return; }
    if (!date) { setError('Date is required'); return; }
    setError('');
    const participants = participantsStr.split(',').map(p => p.trim()).filter(Boolean);
    saveMutation.mutate({
      title: title.trim(),
      subtitle: subtitle.trim(),
      date,
      start_time: startTime,
      location: location.trim(),
      facilitator: facilitator.trim(),
      participants,
      template_id: chosenTemplate || null,
      items: items.map((item, idx) => ({
        title: item.title,
        duration_minutes: item.duration_minutes,
        format: item.format as MeetingFormat,
        objective: item.objective,
        illustration: item.illustration,
        approach: item.approach,
        is_break: item.is_break,
        notes: item.notes,
        position: idx,
      })),
    });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5 relative overflow-hidden card-accent">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-black text-navy">
            {isEdit ? 'Edit Meeting' : 'New Meeting'}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-muted border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Meeting'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-[11px] text-coral bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* Meeting details */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5">
        <h2 className="font-extrabold text-navy text-sm mb-4">Meeting Details</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q1 Trustees Meeting"
              className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors" />
          </div>
          <div>
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1">Subtitle</label>
            <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Optional subtitle"
              className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors" />
          </div>
          <div>
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1">Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors" />
          </div>
          <div>
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1">Start Time</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
              className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm font-mono text-navy bg-srf focus:border-teal transition-colors" />
          </div>
          <div>
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1">Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Venue or online link"
              className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors" />
          </div>
          <div>
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1">Facilitator</label>
            <input value={facilitator} onChange={e => setFacilitator(e.target.value)} placeholder="Name"
              className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1">
              Participants <span className="normal-case font-normal">(comma-separated)</span>
            </label>
            <input value={participantsStr} onChange={e => setParticipantsStr(e.target.value)}
              placeholder="Alice, Bob, Carol"
              className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors" />
          </div>
        </div>
      </div>

      {/* Template selector */}
      {!isEdit && (
        <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5">
          <h2 className="font-extrabold text-navy text-sm mb-3">Import from Template</h2>
          <select
            value={chosenTemplate}
            onChange={e => onTemplateChange(e.target.value)}
            className="w-full sm:max-w-xs border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors"
          >
            <option value="">— Build from scratch —</option>
            {templateList.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {chosenTemplate && (
            <p className="text-[10px] text-teal-dk mt-2 font-bold">
              ✓ Template loaded — you can edit the sessions below
            </p>
          )}
        </div>
      )}

      {/* Agenda editor */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5">
        <h2 className="font-extrabold text-navy text-sm mb-4">Agenda Sessions</h2>
        <AgendaEditor items={items} startTime={startTime} onChange={setItems} />
      </div>
    </div>
  );
}
