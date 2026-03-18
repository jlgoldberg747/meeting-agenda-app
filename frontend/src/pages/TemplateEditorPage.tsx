import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import AgendaEditor from '../components/AgendaEditor';
import type { AgendaItemBase, MeetingFormat } from '../types';
import { FORMATS, m2t, t2m } from '../types';

type EditItem = Omit<AgendaItemBase, 'id'> & { id: string };

export default function TemplateEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(id);

  const { data: existing, isLoading } = useQuery({
    queryKey: ['template', id],
    queryFn: () => api.templates.get(id!),
    enabled: isEdit,
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [items, setItems] = useState<EditItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description || '');
      setStartTime(existing.start_time);
      setItems(existing.items.map(i => ({ ...i })));
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      isEdit ? api.templates.update(id!, data) : api.templates.create(data),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      navigate(`/templates`);
    },
    onError: (err: any) => setError(err.message),
  });

  const handleSave = () => {
    if (!name.trim()) { setError('Template name is required'); return; }
    setError('');
    saveMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      start_time: startTime,
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

  const downloadTemplateXlsx = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Organisation', ''],
      ['Meeting Title', ''],
      ['Subtitle', ''],
      ['Date', ''],
      ['Location', ''],
      ['Facilitator', ''],
      ['Start Time', '09:00'],
    ]), 'Meeting metadata');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Start', 'Finish', 'Format', 'Topic', 'Objective', 'Illustration', 'Approach'],
      ['09:00', '09:30', 'FIP', 'Opening', '', '', ''],
      ['', '10:00', 'WND', 'Session 1', '', '', ''],
      ['', '10:15', 'BRK', 'Tea Break', '', '', ''],
    ]), 'Detailed agenda');
    const fd: string[][] = [['Format types']];
    FORMATS.forEach(f => fd.push([`${f.c} — ${f.l}`]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fd), 'List');
    XLSX.writeFile(wb, 'Agenda_Template.xlsx');
  };

  const exportAgendaXlsx = () => {
    if (items.length === 0) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Template Name', name],
      ['Description', description],
      ['Start Time', startTime],
    ]), 'Meeting metadata');
    let cur = t2m(startTime);
    const agendaData = [['Start', 'Finish', 'Format', 'Topic', 'Objective', 'Illustration', 'Approach']];
    items.forEach(item => {
      const st = m2t(cur);
      cur += item.duration_minutes;
      const en = m2t(cur);
      agendaData.push([st, en, item.format || '', item.title, item.objective || '', item.illustration || '', item.approach || '']);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(agendaData);
    ws2['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 22 }, { wch: 35 }, { wch: 18 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Detailed agenda');
    const fd: string[][] = [['Format types']];
    FORMATS.forEach(f => fd.push([`${f.c} — ${f.l}`]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fd), 'List');
    XLSX.writeFile(wb, `${(name || 'Template').replace(/[^a-zA-Z0-9 ]/g, '')}_Agenda.xlsx`);
  };

  const addDefaultItems = () => {
    setItems([
      { id: 'tmp-1', position: 0, title: 'Welcome & Intro', duration_minutes: 10, format: 'FIP', objective: '', illustration: '', approach: '', is_break: false, notes: '' },
      { id: 'tmp-2', position: 1, title: 'Session 1', duration_minutes: 30, format: 'WND', objective: '', illustration: '', approach: '', is_break: false, notes: '' },
      { id: 'tmp-3', position: 2, title: 'Break', duration_minutes: 15, format: 'BRK', objective: '', illustration: '', approach: '', is_break: true, notes: '' },
      { id: 'tmp-4', position: 3, title: 'Session 2', duration_minutes: 45, format: 'P+D', objective: '', illustration: '', approach: '', is_break: false, notes: '' },
      { id: 'tmp-5', position: 4, title: 'Wrap Up', duration_minutes: 10, format: 'O', objective: '', illustration: '', approach: '', is_break: false, notes: '' },
    ]);
  };

  if (isEdit && isLoading) {
    return <div className="py-20 text-center text-muted text-sm animate-pulse">Loading template…</div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5 relative overflow-hidden card-accent">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-navy">
              {isEdit ? 'Edit Template' : 'New Template'}
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={downloadTemplateXlsx}
              className="px-3 py-2 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-muted border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all"
              title="Download blank template .xlsx"
            >
              ↓ Template
            </button>
            {items.length > 0 && (
              <button
                onClick={exportAgendaXlsx}
                className="px-3 py-2 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-navy border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all"
              >
                ↓ Export .xlsx
              </button>
            )}
            <button
              onClick={() => navigate('/templates')}
              className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-muted border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-[11px] text-coral bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* Template details */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5">
        <h2 className="font-extrabold text-navy text-sm mb-4">Template Details</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1">
              Template Name *
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Quarterly Trustees Meeting"
              className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors"
            />
          </div>
          <div>
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1">
              Default Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm font-mono text-navy bg-srf focus:border-teal transition-colors"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what this template is for…"
              rows={2}
              className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2 text-sm text-navy bg-srf focus:border-teal transition-colors resize-none"
            />
          </div>
        </div>
      </div>

      {/* Agenda editor */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-navy text-sm">Agenda Sessions</h2>
          {items.length === 0 && (
            <button
              onClick={addDefaultItems}
              className="text-[10px] font-bold text-teal-dk hover:underline"
            >
              Load example sessions
            </button>
          )}
        </div>
        <AgendaEditor items={items} startTime={startTime} onChange={setItems} />
      </div>
    </div>
  );
}
