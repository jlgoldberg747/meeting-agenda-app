import { useState, useEffect } from 'react';

export type ChimeType = 'bell' | 'bowl' | 'ping' | 'chord' | 'silent';

export const CHIME_OPTIONS: { id: ChimeType; label: string; desc: string; emoji: string }[] = [
  { id: 'bell',   label: 'Soft Bell',      desc: 'Warm, pure tone — the classic session chime',           emoji: '🔔' },
  { id: 'bowl',   label: 'Meditation Bowl', desc: 'Slow resonant hum, low and grounding',                  emoji: '🪬' },
  { id: 'ping',   label: 'Digital Ping',   desc: 'Clean, crisp modern alert',                              emoji: '💫' },
  { id: 'chord',  label: 'Gentle Chord',   desc: 'Two-note harmony — soft and reassuring',                 emoji: '🎵' },
  { id: 'silent', label: 'Silence',        desc: 'No sound — visual timer only',                          emoji: '🔕' },
];

export const CHIME_KEY = 'meetingagenda_chime';

export function getSelectedChime(): ChimeType {
  return (localStorage.getItem(CHIME_KEY) as ChimeType) || 'bell';
}

// ── Web Audio chime synthesizer ───────────────────────────────────────────────
let audioCtx: AudioContext | null = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioCtx;
}

export function playChimeByType(type: ChimeType, loud = false) {
  if (type === 'silent') return;
  const ctx = getCtx();
  const now = ctx.currentTime;
  const vol = loud ? 0.55 : 0.28;

  switch (type) {
    case 'bell': {
      // Pure sine, quick attack, long decay
      const dur = loud ? 4 : 2.8;
      [loud ? 528 : 660, loud ? 1056 : 1320].forEach((freq, i) => {
        const g = ctx.createGain();
        g.connect(ctx.destination);
        g.gain.setValueAtTime(vol / (i + 1), now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur * (1 - i * 0.25));
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now);
        o.connect(g);
        o.start(now);
        o.stop(now + dur);
      });
      break;
    }
    case 'bowl': {
      // Low freq, very slow attack, long sustain — meditation bowl feel
      const dur = loud ? 5 : 3.5;
      const baseFreq = loud ? 220 : 256;
      [baseFreq, baseFreq * 2.76].forEach((freq, i) => {
        const g = ctx.createGain();
        g.connect(ctx.destination);
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(vol / (i + 1), now + 0.3);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now);
        o.connect(g);
        o.start(now);
        o.stop(now + dur);
      });
      break;
    }
    case 'ping': {
      // Quick triangle wave, bright, digital
      const dur = loud ? 1.5 : 0.9;
      const freq = loud ? 880 : 1047;
      const g = ctx.createGain();
      g.connect(ctx.destination);
      g.gain.setValueAtTime(vol * 1.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, now);
      o.connect(g);
      o.start(now);
      o.stop(now + dur);
      break;
    }
    case 'chord': {
      // Two-note major third harmony, gentle sine
      const dur = loud ? 3.5 : 2.2;
      const freqs = loud ? [392, 494, 659] : [523, 659, 784];
      freqs.forEach((freq, i) => {
        const g = ctx.createGain();
        g.connect(ctx.destination);
        g.gain.setValueAtTime(vol * 0.6, now + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur - i * 0.1);
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now);
        o.connect(g);
        o.start(now + i * 0.06);
        o.stop(now + dur);
      });
      break;
    }
  }
}

// ── Settings Page ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [selected, setSelected] = useState<ChimeType>(getSelectedChime());
  const [previewing, setPreviewing] = useState<ChimeType | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSelected(getSelectedChime());
  }, []);

  const handleSelect = (id: ChimeType) => {
    setSelected(id);
    localStorage.setItem(CHIME_KEY, id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePreview = (id: ChimeType) => {
    setPreviewing(id);
    playChimeByType(id, false);
    setTimeout(() => setPreviewing(null), 1500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-6 relative overflow-hidden card-accent">
        <h1 className="text-xl font-black text-navy">Settings</h1>
        <p className="text-[12px] text-muted mt-1">Preferences for your facilitation experience</p>
      </div>

      {/* Chime section */}
      <div className="bg-srf border-[1.5px] border-bdr rounded-card shadow-card p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-extrabold text-navy text-sm">Session Transition Chime</h2>
          {saved && (
            <span className="text-[10px] font-extrabold text-teal-dk animate-fade-in">
              ✓ Saved
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted mb-5 leading-relaxed">
          Choose the sound that plays at session transitions during live meetings.
          Click Preview to hear each option before selecting.
        </p>

        <div className="space-y-2.5">
          {CHIME_OPTIONS.map(opt => {
            const isSelected = selected === opt.id;
            const isPreviewing = previewing === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                className={`flex items-center gap-4 p-4 rounded-sm border-[1.5px] cursor-pointer transition-all
                  ${isSelected
                    ? 'border-teal bg-[var(--teal-glow)] shadow-[0_0_0_2px_rgba(43,188,200,0.12)]'
                    : 'border-bdr hover:border-[rgba(43,188,200,0.4)] hover:bg-[var(--teal-glow)]'
                  }`}
              >
                {/* Radio */}
                <div className={`w-4 h-4 rounded-full border-[2px] flex-shrink-0 flex items-center justify-center transition-all
                  ${isSelected ? 'border-teal-dk' : 'border-bdr'}`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-teal-dk" />}
                </div>

                {/* Emoji */}
                <span className="text-xl flex-shrink-0">{opt.emoji}</span>

                {/* Label + desc */}
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-navy text-[13px]">{opt.label}</div>
                  <div className="text-[11px] text-muted leading-relaxed">{opt.desc}</div>
                </div>

                {/* Preview button */}
                {opt.id !== 'silent' && (
                  <button
                    onClick={e => { e.stopPropagation(); handlePreview(opt.id); }}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full font-extrabold text-[9px] uppercase tracking-wider border-[1.5px] transition-all
                      ${isPreviewing
                        ? 'border-teal-dk text-teal-dk bg-[var(--teal-glow)]'
                        : 'border-bdr text-muted hover:border-teal-dk hover:text-teal-dk'
                      }`}
                  >
                    {isPreviewing ? '♪ Playing…' : 'Preview'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-muted mt-4 leading-relaxed">
          Your preference is saved locally and applied whenever you run a live session.
        </p>
      </div>
    </div>
  );
}
