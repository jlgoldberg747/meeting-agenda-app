/**
 * Robust Excel/CSV parser for meeting agendas
 * Handles various column naming conventions and structures
 */

import * as XLSX from 'xlsx';

export interface ParsedItem {
  id: string;
  position: number;
  title: string;
  duration_minutes: number;
  format: string;
  objective: string;
  illustration: string;
  approach: string;
  is_break: boolean;
  notes: string;
}

export interface ParsedMeta {
  org?: string;
  title?: string;
  subtitle?: string;
  date?: string;
  location?: string;
  facilitator?: string;
  startTime?: string;
}

export interface ParseResult {
  items: ParsedItem[];
  meta: ParsedMeta | null;
  newStartTime: string | null;
  warnings: string[];
}

// Valid format codes (must match MeetingFormat enum in DB)
const VALID_FORMATS = ['FIP', 'FI', 'P+D', 'D', 'WND', 'W+D', 'PR', 'O', 'BRK'];

let _idCounter = Date.now();
function nextId(): string {
  return `imp-${_idCounter++}`;
}

// ─── Time Utilities ────────────────────────────────────────────────────────────

function parseTimeValue(v: any): string | null {
  if (v == null || v === '') return null;
  
  // String time like "09:30" or "9:30"
  if (typeof v === 'string') {
    const m = v.match(/(\d{1,2})[:\.](\d{2})/);
    if (m) return `${String(m[1]).padStart(2, '0')}:${m[2]}`;
    
    // Excel serial time (0-1 range as string)
    const n = parseFloat(v);
    if (!isNaN(n) && n > 0 && n < 1) {
      return minutesToTime(Math.round(n * 1440));
    }
    return null;
  }
  
  // Excel serial time (number 0-1)
  if (typeof v === 'number' && v >= 0 && v < 1) {
    return minutesToTime(Math.round(v * 1440));
  }
  
  return null;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseDuration(v: any): number | null {
  if (v == null || v === '') return null;
  
  const str = String(v).trim().toLowerCase();
  
  // "30 min", "30min", "30 minutes"
  const minMatch = str.match(/^(\d+)\s*(?:min|minutes?|m)?$/i);
  if (minMatch) return parseInt(minMatch[1], 10);
  
  // "1h", "1 hour", "1.5h"
  const hourMatch = str.match(/^(\d+(?:\.\d+)?)\s*(?:h|hr|hours?)?$/i);
  if (hourMatch && str.includes('h')) return Math.round(parseFloat(hourMatch[1]) * 60);
  
  // Plain number
  const num = parseInt(str, 10);
  if (!isNaN(num) && num > 0 && num < 480) return num;
  
  return null;
}

// ─── Column Detection ──────────────────────────────────────────────────────────

interface ColumnMap {
  title: string | null;
  duration: string | null;
  startTime: string | null;
  endTime: string | null;
  format: string | null;
  objective: string | null;
  approach: string | null;
  notes: string | null;
  illustration: string | null;
}

const COLUMN_PATTERNS: Record<keyof ColumnMap, RegExp[]> = {
  title: [/^(topic|title|session|item|agenda|subject|activity|name)$/i, /topic|title|session|item|agenda|subject|activity/i],
  duration: [/^(duration|dur|time|minutes|mins|length)$/i, /duration|mins|minutes/i],
  startTime: [/^(start|begin|from|start.?time)$/i, /start/i],
  endTime: [/^(end|finish|to|end.?time|until)$/i, /end|finish/i],
  format: [/^(format|fmt|type|category|method)$/i, /format|type/i],
  objective: [/^(objective|obj|goal|purpose|description|desc)$/i, /objective|goal|purpose/i],
  approach: [/^(approach|method|how|facilitation|process|notes)$/i, /approach|method/i],
  notes: [/^(notes|comments|remarks|details)$/i, /notes|comment/i],
  illustration: [/^(illustration|visual|image|diagram|illus)$/i, /illus|visual/i],
};

function detectColumns(keys: string[]): ColumnMap {
  const map: ColumnMap = {
    title: null,
    duration: null,
    startTime: null,
    endTime: null,
    format: null,
    objective: null,
    approach: null,
    notes: null,
    illustration: null,
  };
  
  // First pass: exact matches
  for (const field of Object.keys(COLUMN_PATTERNS) as (keyof ColumnMap)[]) {
    const exactPattern = COLUMN_PATTERNS[field][0];
    const found = keys.find(k => exactPattern.test(k.trim()));
    if (found) map[field] = found;
  }
  
  // Second pass: partial matches for unfilled fields
  for (const field of Object.keys(COLUMN_PATTERNS) as (keyof ColumnMap)[]) {
    if (map[field]) continue;
    const fuzzyPattern = COLUMN_PATTERNS[field][1];
    if (!fuzzyPattern) continue;
    const found = keys.find(k => fuzzyPattern.test(k.trim()) && !Object.values(map).includes(k));
    if (found) map[field] = found;
  }
  
  // Fallback: if no title found, use first non-empty text column
  if (!map.title && keys.length > 0) {
    map.title = keys[0];
  }
  
  return map;
}

// ─── Row Processing ────────────────────────────────────────────────────────────

function isBreakItem(title: string): boolean {
  return /\b(break|lunch|tea|coffee|pause|recess|intermission|rest)\b/i.test(title);
}

function normalizeFormat(raw: string): string {
  const upper = raw.toUpperCase().trim();
  if (VALID_FORMATS.includes(upper)) return upper;
  
  // Common variations → map to valid MeetingFormat codes
  if (/^(disc|discussion)$/i.test(raw)) return 'D';
  if (/^(review|recap)$/i.test(raw)) return 'FI';
  if (/^(action|activity)$/i.test(raw)) return 'WND';
  if (/^(input|info|presentation)$/i.test(raw)) return 'FIP';
  if (/^(workshop)$/i.test(raw)) return 'WND';
  if (/^(q&?a|questions?)$/i.test(raw)) return 'O';
  if (/^(plenary)$/i.test(raw)) return 'FIP';
  if (/^(prayer|devotion)$/i.test(raw)) return 'PR';
  if (/^(break|brk)$/i.test(raw)) return 'BRK';
  
  return 'O'; // Default to Open
}

function processRows(
  rows: Record<string, any>[],
  defaultStartTime: string = '09:00'
): { items: ParsedItem[]; newStartTime: string | null; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return { items: [], newStartTime: null, warnings: ['No data rows found in file'] };
  }
  
  // Filter out completely empty rows
  const validRows = rows.filter(row => {
    if (!row || typeof row !== 'object') return false;
    return Object.values(row).some(v => v != null && String(v).trim() !== '');
  });
  
  if (validRows.length === 0) {
    return { items: [], newStartTime: null, warnings: ['All rows are empty'] };
  }
  
  // Detect columns from first valid row
  const keys = Object.keys(validRows[0]);
  const cols = detectColumns(keys);
  
  if (!cols.title) {
    warnings.push('Could not detect title/topic column');
  }
  
  const items: ParsedItem[] = [];
  let previousEndTime: string | null = null;
  let newStartTime: string | null = null;
  
  for (const row of validRows) {
    // Get title - skip if empty
    const titleRaw = cols.title ? row[cols.title] : null;
    if (!titleRaw || String(titleRaw).trim() === '') continue;
    
    const title = String(titleRaw).trim();
    
    // Skip obvious header rows
    if (/^(topic|title|session|item|agenda)$/i.test(title)) continue;
    
    // Parse times
    let startTime = cols.startTime ? parseTimeValue(row[cols.startTime]) : null;
    const endTime = cols.endTime ? parseTimeValue(row[cols.endTime]) : null;
    
    // Use previous end as current start if not specified
    if (!startTime && previousEndTime) {
      startTime = previousEndTime;
    }
    
    // Calculate duration
    let duration = cols.duration ? parseDuration(row[cols.duration]) : null;
    
    if (!duration && startTime && endTime) {
      duration = timeToMinutes(endTime) - timeToMinutes(startTime);
      if (duration <= 0) duration = null;
    }
    
    // Default duration
    if (!duration || duration <= 0) {
      duration = 30;
    }
    
    // Update previous end time
    if (endTime) {
      previousEndTime = endTime;
    } else if (startTime) {
      previousEndTime = minutesToTime(timeToMinutes(startTime) + duration);
    }
    
    // Track first item's start time
    if (items.length === 0 && startTime) {
      newStartTime = startTime;
    }
    
    // Determine format
    const isBreak = isBreakItem(title);
    let format = 'O';
    if (cols.format && row[cols.format]) {
      format = normalizeFormat(String(row[cols.format]));
    } else if (isBreak) {
      format = 'BRK';
    }
    
    // Gather other fields
    const objective = cols.objective ? String(row[cols.objective] || '').trim() : '';
    const approach = cols.approach ? String(row[cols.approach] || '').trim() : '';
    const notes = cols.notes ? String(row[cols.notes] || '').trim() : '';
    const illustration = cols.illustration ? String(row[cols.illustration] || '').trim() : '';
    
    items.push({
      id: nextId(),
      position: items.length,
      title,
      duration_minutes: duration,
      format,
      objective: objective.replace(/\\n/g, '\n'),
      illustration,
      approach: (approach || notes).replace(/\\n/g, '\n'),
      is_break: isBreak || format === 'BRK',
      notes: notes.replace(/\\n/g, '\n'),
    });
  }
  
  if (items.length === 0) {
    warnings.push('No valid agenda items could be parsed from the data');
  }
  
  return { items, newStartTime, warnings };
}

// ─── Meta Sheet Parsing ────────────────────────────────────────────────────────

function parseMetaSheet(sheet: XLSX.WorkSheet): ParsedMeta {
  const meta: ParsedMeta = {};
  
  try {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as any[][];
    
    for (const row of rows) {
      if (!row || !row[0]) continue;
      
      const key = String(row[0]).toLowerCase().trim();
      const value = row[1] != null ? String(row[1]).trim() : '';
      
      if (!value) continue;
      
      if (key.includes('organisation') || key.includes('organization') || key.includes('company')) {
        meta.org = value;
      } else if (key.includes('title') && !key.includes('sub')) {
        meta.title = value;
      } else if (key.includes('subtitle') || key.includes('sub-title')) {
        meta.subtitle = value;
      } else if (key.includes('date')) {
        meta.date = value;
      } else if (key.includes('location') || key.includes('venue')) {
        meta.location = value;
      } else if (key.includes('facilitator') || key.includes('host') || key.includes('chair')) {
        meta.facilitator = value;
      } else if (key.includes('start') && key.includes('time')) {
        meta.startTime = parseTimeValue(row[1]) || value;
      }
    }
  } catch (e) {
    // Ignore meta parsing errors
  }
  
  return meta;
}

// ─── Main Parser ───────────────────────────────────────────────────────────────

export function parseExcelFile(
  file: File,
  defaultStartTime: string = '09:00'
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    const handleError = (msg: string) => {
      reject(new Error(msg));
    };
    
    if (ext === 'csv' || ext === 'tsv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: 'string' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
          const { items, newStartTime, warnings } = processRows(rows as any[], defaultStartTime);
          resolve({ items, meta: null, newStartTime, warnings });
        } catch (err: any) {
          handleError(`Failed to parse CSV: ${err.message}`);
        }
      };
      reader.onerror = () => handleError('Failed to read file');
      reader.readAsText(file);
      
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: 'array', raw: true });
          
          // Find meta and agenda sheets
          let metaSheet: XLSX.WorkSheet | null = null;
          let agendaSheet: XLSX.WorkSheet | null = null;
          
          for (const name of wb.SheetNames) {
            const lower = name.toLowerCase();
            if (lower.includes('meta') || lower.includes('info') || lower.includes('details')) {
              metaSheet = wb.Sheets[name];
            }
            if (lower.includes('agenda') || lower.includes('detail') || lower.includes('schedule') || lower.includes('program')) {
              agendaSheet = wb.Sheets[name];
            }
          }
          
          // Fallback: first sheet for single-sheet files, or second sheet for multi-sheet
          if (!agendaSheet) {
            if (wb.SheetNames.length >= 2 && !metaSheet) {
              metaSheet = wb.Sheets[wb.SheetNames[0]];
              agendaSheet = wb.Sheets[wb.SheetNames[1]];
            } else {
              agendaSheet = wb.Sheets[wb.SheetNames[0]];
            }
          }
          
          // Parse meta
          const meta = metaSheet ? parseMetaSheet(metaSheet) : null;
          
          // Parse agenda
          const rows = XLSX.utils.sheet_to_json(agendaSheet!, { defval: '', raw: true });
          const { items, newStartTime, warnings } = processRows(rows as any[], meta?.startTime || defaultStartTime);
          
          resolve({ items, meta, newStartTime, warnings });
        } catch (err: any) {
          handleError(`Failed to parse Excel: ${err.message}`);
        }
      };
      reader.onerror = () => handleError('Failed to read file');
      reader.readAsArrayBuffer(file);
      
    } else if (ext === 'json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          const rows = Array.isArray(parsed) 
            ? parsed 
            : parsed.items ?? parsed.sessions ?? parsed.agenda ?? [];
          const { items, newStartTime, warnings } = processRows(rows, defaultStartTime);
          resolve({ items, meta: null, newStartTime, warnings });
        } catch (err: any) {
          handleError(`Invalid JSON: ${err.message}`);
        }
      };
      reader.onerror = () => handleError('Failed to read file');
      reader.readAsText(file);
      
    } else {
      handleError('Unsupported file type. Use .xlsx, .xls, .csv, or .json');
    }
  });
}
