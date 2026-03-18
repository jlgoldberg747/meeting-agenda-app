import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Template } from '../types';

function TemplateCard({ template, onDuplicate, onDelete, onExport }: {
  template: Template;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const totalMins = template.items.reduce((s, i) => s + i.duration_minutes, 0);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;

  return (
    <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card hover:shadow-card-lg hover:-translate-y-0.5 transition-all overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-teal-dk to-teal-br" style={{ position: 'relative', height: '3px', background: 'linear-gradient(90deg,#1A9AA6,#2BBCC8)' }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-extrabold text-navy text-[14px] truncate">{template.name}</h3>
            {template.description && (
              <p className="text-muted text-[11px] mt-0.5 line-clamp-2">{template.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="font-mono text-[9px] text-muted bg-srf-alt px-2 py-0.5 rounded">
              {h > 0 ? `${h}h` : ''}{m > 0 ? ` ${m}m` : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <span className="text-[10px] text-slate font-bold">{template.items.length} sessions</span>
          <span className="text-[10px] text-muted">Starts {template.start_time}</span>
        </div>

        {/* Item preview */}
        {template.items.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setOpen(!open)}
              className="text-[9px] font-bold text-teal-dk hover:underline"
            >
              {open ? '▲ Hide sessions' : '▼ Show sessions'}
            </button>
            {open && (
              <div className="mt-2 space-y-0.5">
                {template.items.slice(0, 8).map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-[10px] text-slate">
                    <span className="font-mono text-muted w-8">{item.duration_minutes}m</span>
                    <span className={item.is_break ? 'text-muted italic' : ''}>{item.is_break ? '☕ ' : ''}{item.title}</span>
                  </div>
                ))}
                {template.items.length > 8 && (
                  <div className="text-[10px] text-muted">+{template.items.length - 8} more…</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <Link
            to={`/templates/${template.id}/edit`}
            className="px-3 py-1.5 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-teal-dk border-[1.5px] border-[rgba(43,188,200,0.3)] bg-[rgba(43,188,200,0.08)] hover:bg-teal hover:text-white transition-all"
          >
            Edit
          </Link>
          <Link
            to={`/meetings/new?template=${template.id}`}
            className="px-3 py-1.5 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all"
          >
            Use Template
          </Link>
          <button
            onClick={onDuplicate}
            className="px-3 py-1.5 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-muted border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all"
          >
            Duplicate
          </button>
          <button
            onClick={onExport}
            className="px-3 py-1.5 rounded-full font-extrabold text-[10px] uppercase tracking-wider text-muted border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all"
          >
            Export JSON
          </button>
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

export default function TemplatesPage() {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery({ queryKey: ['templates'], queryFn: api.templates.list });

  const importRef = useRef<HTMLInputElement>(null);

  const dupMutation = useMutation({
    mutationFn: api.templates.duplicate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.templates.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });

  const handleExport = (template: Template) => {
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.templates.create({
        name: data.name + ' (Imported)',
        description: data.description,
        start_time: data.start_time,
        items: data.items?.map((item: any) => ({
          title: item.title,
          duration_minutes: item.duration_minutes,
          format: item.format || 'O',
          objective: item.objective || '',
          illustration: item.illustration || '',
          approach: item.approach || '',
          is_break: item.is_break || false,
          notes: item.notes || '',
        })),
      });
      qc.invalidateQueries({ queryKey: ['templates'] });
    } catch {
      alert('Failed to import template. Please check the file format.');
    }
    if (importRef.current) importRef.current.value = '';
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete template "${name}"? This cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-5 relative overflow-hidden card-accent">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-navy">Template Library</h1>
            <p className="text-slate text-sm mt-0.5">
              {templates.length} {templates.length === 1 ? 'template' : 'templates'}
            </p>
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-navy border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all">
              Import JSON
              <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
            <Link
              to="/templates/new"
              className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all"
            >
              + New Template
            </Link>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-10 text-muted text-sm animate-pulse">Loading templates…</div>
      )}

      {!isLoading && templates.length === 0 && (
        <div className="bg-srf border-[1.5px] border-dashed border-bdr rounded-card p-10 text-center">
          <div className="text-4xl opacity-20 mb-3">📋</div>
          <p className="text-slate font-bold">No templates yet</p>
          <p className="text-muted text-sm mt-1">Create a reusable meeting agenda template.</p>
          <Link
            to="/templates/new"
            className="inline-block mt-4 px-5 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all"
          >
            Create First Template
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            onDuplicate={() => dupMutation.mutate(t.id)}
            onDelete={() => handleDelete(t.id, t.name)}
            onExport={() => handleExport(t)}
          />
        ))}
      </div>
    </div>
  );
}
