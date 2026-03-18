import { useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import type { AgendaItemBase, MeetingFormat } from '../types';
import { FORMATS, m2t, t2m } from '../types';
import { parseExcelFile } from '../lib/excelParser';

type EditableItem = Omit<AgendaItemBase, 'id'> & { id: string; tempId?: string };

interface Props {
  items: EditableItem[];
  startTime: string;
  onChange: (items: EditableItem[]) => void;
  readOnly?: boolean;
}

function calcStart(items: EditableItem[], idx: number, startTime: string): string {
  let cur = t2m(startTime);
  for (let i = 0; i < idx; i++) cur += items[i].duration_minutes;
  return m2t(cur);
}

let tempIdCounter = 1;
function newTempId() { return `tmp-${tempIdCounter++}`; }

// ─── Item Edit Modal ──────────────────────────────────────────────────────────
function ItemModal({
  item,
  onSave,
  onCancel,
}: {
  item: EditableItem;
  onSave: (updated: EditableItem) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<EditableItem>({ ...item });
  const fmt = FORMATS.find(f => f.c === draft.format) || FORMATS[7];

  const set = (field: string, value: unknown) => {
    setDraft(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'format') next.is_break = value === 'BRK';
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-[rgba(13,31,60,0.45)] backdrop-blur-sm z-[300] flex items-center justify-center p-4">
      <div className="bg-srf border-[1.5px] border-bdr rounded-[20px] w-full max-w-xl shadow-card-lg relative animate-fade-in flex flex-col max-h-[90vh]">
        {/* Accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: `linear-gradient(90deg, ${fmt.cl}, #2BBCC8)` }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-7 pb-4 border-b border-bdr flex-shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ color: fmt.cl, background: `${fmt.cl}18` }}
            >
              {fmt.c}
            </span>
            <h2 className="font-black text-navy text-base">Edit Session</h2>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted hover:bg-srf-alt hover:text-slate transition-all text-sm"
          >✕</button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
          {/* Title + Duration row */}
          <div className="grid grid-cols-[1fr_100px] gap-4">
            <div>
              <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1.5">
                Session Title
              </label>
              <input
                value={draft.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Session title"
                className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2.5 text-sm font-bold text-navy bg-bg focus:border-teal transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1.5">
                Duration (min)
              </label>
              <input
                type="number"
                min={1}
                value={draft.duration_minutes}
                onChange={e => set('duration_minutes', Math.max(1, parseInt(e.target.value) || 5))}
                className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2.5 text-sm font-mono font-bold text-teal-dk text-center bg-bg focus:border-teal transition-colors"
              />
            </div>
          </div>

          {/* Format + Break row */}
          <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
            <div>
              <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1.5">
                Format
              </label>
              <select
                value={draft.format}
                onChange={e => set('format', e.target.value as MeetingFormat)}
                className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2.5 text-sm bg-bg focus:border-teal transition-colors"
                style={{ color: fmt.cl, fontWeight: 700 }}
              >
                {FORMATS.map(f => (
                  <option key={f.c} value={f.c}>{f.c} — {f.l}</option>
                ))}
              </select>
            </div>
            <div>
              <button
                onClick={() => set('is_break', !draft.is_break)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-sm border-[1.5px] text-sm font-bold transition-all ${
                  draft.is_break
                    ? 'bg-amber/10 text-amber border-amber'
                    : 'text-muted border-bdr hover:border-amber hover:text-amber'
                }`}
              >
                ☕ {draft.is_break ? 'Break' : 'Break?'}
              </button>
            </div>
          </div>

          {/* Objective */}
          <div>
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1.5">
              Objective
            </label>
            <input
              value={draft.objective}
              onChange={e => set('objective', e.target.value)}
              placeholder="What should participants leave with?"
              className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2.5 text-sm text-navy bg-bg focus:border-teal transition-colors"
            />
          </div>

          {/* Approach / Notes — large textarea */}
          <div>
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1.5">
              Approach / Notes
            </label>
            <textarea
              value={draft.approach}
              onChange={e => set('approach', e.target.value)}
              placeholder="Describe the approach, facilitation method, materials needed, or any notes for the facilitator…"
              rows={6}
              className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2.5 text-sm text-navy bg-bg focus:border-teal transition-colors resize-y leading-relaxed"
            />
          </div>

          {/* Illustration */}
          <div>
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted mb-1.5">
              Illustration / Visual Reference
            </label>
            <input
              value={draft.illustration}
              onChange={e => set('illustration', e.target.value)}
              placeholder="Optional: describe or link a visual"
              className="w-full border-[1.5px] border-bdr rounded-sm px-3 py-2.5 text-sm text-slate bg-bg focus:border-teal transition-colors"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-bdr flex-shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-muted border-[1.5px] border-bdr hover:border-teal hover:text-teal-dk transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            className="px-5 py-2 rounded-full font-extrabold text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-teal-dk to-teal-br shadow-teal hover:-translate-y-0.5 transition-all"
          >
            Save Session
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── File Import Parsing ──────────────────────────────────────────────────────
// parseImportedRows and parseFile replaced by shared excelParser.ts

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AgendaEditor({ items, startTime, onChange, readOnly }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [importError, setImportError] = useState('');

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setFileDragOver(false);
    setImportError('');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    try {
      const result = await parseExcelFile(file);
      if (result.items.length === 0) {
        setImportError(result.warnings?.[0] || 'No valid agenda items found in file');
        return;
      }
      const mapped: EditableItem[] = result.items.map(item => ({
        ...item,
        format: item.format as MeetingFormat,
      }));
      onChange([...items, ...mapped]);
    } catch (err: any) {
      setImportError(err.message || 'Failed to parse file');
    }
  }, [items, onChange]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await parseExcelFile(file);
      if (result.items.length === 0) {
        setImportError(result.warnings?.[0] || 'No valid agenda items found in file');
        return;
      }
      const mapped: EditableItem[] = result.items.map(item => ({
        ...item,
        format: item.format as MeetingFormat,
      }));
      onChange([...items, ...mapped]);
    } catch (err: any) {
      setImportError(err.message || 'Failed to parse file');
    }
    e.target.value = '';
  }, [items, onChange]);

  const editingItem = editingId ? items.find(i => i.id === editingId) ?? null : null;

  const saveItem = (updated: EditableItem) => {
    onChange(items.map(i => i.id === updated.id ? updated : i));
    setEditingId(null);
  };

  const removeItem = (id: string) => {
    onChange(items.filter(i => i.id !== id));
  };

  const addItem = (afterId?: string) => {
    const newItem: EditableItem = {
      id: newTempId(),
      position: 0,
      title: 'New Session',
      duration_minutes: 30,
      format: 'O' as MeetingFormat,
      objective: '',
      illustration: '',
      approach: '',
      is_break: false,
      notes: '',
    };
    if (!afterId) {
      onChange([...items, newItem]);
    } else {
      const idx = items.findIndex(i => i.id === afterId);
      const next = [...items];
      next.splice(idx + 1, 0, newItem);
      onChange(next);
    }
  };

  const onDragEnd = (result: DropResult) => {
    setDragOver(null);
    if (!result.destination) return;
    const next = [...items];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    onChange(next.map((item, idx) => ({ ...item, position: idx })));
  };

  // ── Read-only table view ────────────────────────────────────────────────────
  if (readOnly) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-srf-alt">
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2.5 border-b-[1.5px] border-bdr">Start</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2.5 border-b-[1.5px] border-bdr">Dur</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2.5 border-b-[1.5px] border-bdr">Format</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2.5 border-b-[1.5px] border-bdr">Title</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2.5 border-b-[1.5px] border-bdr">Objective</th>
              <th className="text-left text-[8px] font-extrabold uppercase tracking-widest text-muted px-2 py-2.5 border-b-[1.5px] border-bdr">Approach</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const fmt = FORMATS.find(f => f.c === item.format) || FORMATS[7];
              const start = calcStart(items, idx, startTime);
              return (
                <tr key={item.id} className={`border-b border-srf-alt hover:bg-[var(--teal-glow)] ${item.is_break ? 'opacity-50' : ''}`}
                  style={{ borderLeft: `4px solid ${fmt.cl}` }}>
                  <td className="px-2 py-2 font-mono text-[9px] text-muted whitespace-nowrap">{start}</td>
                  <td className="px-2 py-2 font-mono text-[9px] text-muted">{item.duration_minutes}m</td>
                  <td className="px-2 py-2">
                    <span className="text-[8px] font-extrabold uppercase tracking-wider" style={{ color: fmt.cl }}>{fmt.c}</span>
                  </td>
                  <td className="px-2 py-2 font-bold text-navy">{item.is_break ? '☕ ' : ''}{item.title}</td>
                  <td className="px-2 py-2 text-slate text-[10px]">{item.objective}</td>
                  <td className="px-2 py-2 text-muted text-[10px]">{item.approach}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Editable drag-and-drop view ─────────────────────────────────────────────
  return (
    <>
      <div>
        {/* File import drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setFileDragOver(true); }}
          onDragLeave={() => setFileDragOver(false)}
          onDrop={handleFileDrop}
          className={`mb-3 border-[1.5px] border-dashed rounded-sm px-4 py-3 text-center transition-all ${
            fileDragOver
              ? 'border-teal bg-[var(--teal-glow)] text-teal-dk'
              : 'border-bdr text-muted hover:border-teal hover:text-teal-dk'
          }`}
        >
          <div className="text-[10px] font-extrabold uppercase tracking-wider mb-0.5">
            {fileDragOver ? 'Drop file to import' : 'Import Agenda'}
          </div>
          <div className="text-[9px]">
            Drag & drop an Excel (.xlsx), CSV, or JSON file here
            <label className="ml-1.5 text-teal-dk font-bold cursor-pointer hover:underline">
              or browse
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        </div>
        {importError && (
          <div className="text-[10px] text-coral bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-sm px-3 py-2 mb-3">
            {importError}
          </div>
        )}

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="agenda-items">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                {items.map((item, idx) => {
                  const start = calcStart(items, idx, startTime);
                  const end = m2t(t2m(start) + item.duration_minutes);
                  const fmt = FORMATS.find(f => f.c === item.format) || FORMATS[7];
                  return (
                    <Draggable key={item.id} draggableId={item.id} index={idx}>
                      {(drag, snapshot) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-sm border-[1.5px] border-bdr bg-srf shadow-card transition-all cursor-pointer group
                            ${snapshot.isDragging ? 'opacity-50 bg-srf-alt shadow-card-lg' : ''}
                            ${dragOver === item.id ? 'bg-[var(--teal-glow)] border-[rgba(43,188,200,0.3)]' : ''}
                            hover:border-[rgba(43,188,200,0.3)] hover:bg-[var(--teal-glow)]`}
                          style={{ borderLeft: `3px solid ${fmt.cl}` }}
                          onClick={() => setEditingId(item.id)}
                        >
                          {/* Drag handle */}
                          <span
                            {...drag.dragHandleProps}
                            className="cursor-grab text-muted text-xs select-none flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                            onClick={e => e.stopPropagation()}
                          >⠿</span>

                          {/* Time */}
                          <span className="font-mono text-[9px] text-muted whitespace-nowrap flex-shrink-0 w-[90px]">
                            {start} – {end}
                          </span>

                          {/* Duration badge */}
                          <span className="font-mono font-bold text-[10px] text-teal-dk flex-shrink-0 w-8 text-right">
                            {item.duration_minutes}m
                          </span>

                          {/* Format badge */}
                          <span
                            className="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ color: fmt.cl, background: `${fmt.cl}18` }}
                          >
                            {fmt.c}
                          </span>

                          {/* Title */}
                          <span className="flex-1 font-bold text-navy text-[12px] truncate min-w-0">
                            {item.is_break ? '☕ ' : ''}{item.title}
                          </span>

                          {/* Approach preview */}
                          {item.approach && (
                            <span className="text-[10px] text-muted truncate flex-shrink hidden sm:block max-w-[180px]">
                              {item.approach}
                            </span>
                          )}

                          {/* Edit hint */}
                          <span className="text-[9px] text-teal-dk font-bold opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hidden sm:block">
                            Edit →
                          </span>

                          {/* Action buttons */}
                          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => addItem(item.id)}
                              title="Insert after"
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-teal-dk hover:bg-[var(--teal-glow)] transition-all"
                            >+</button>
                            <button
                              onClick={() => removeItem(item.id)}
                              title="Delete"
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-muted hover:bg-[rgba(239,68,68,0.08)] hover:text-coral transition-all"
                            >✕</button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <div className="mt-2">
          <button
            onClick={() => addItem()}
            className="w-full py-2.5 border-[1.5px] border-dashed border-bdr rounded-sm text-teal-dk font-extrabold text-[11px] hover:border-teal hover:bg-[var(--teal-glow)] transition-all"
          >
            + Add Session
          </button>
        </div>
      </div>

      {/* Modal */}
      {editingItem && (
        <ItemModal
          item={editingItem}
          onSave={saveItem}
          onCancel={() => setEditingId(null)}
        />
      )}
    </>
  );
}
