import { supabase } from './supabase';
import type { Template, Meeting, MeetingItemUpdate } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

async function getHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Templates ---
export const api = {
  templates: {
    list: () => request<Template[]>('/api/templates'),
    get: (id: string) => request<Template>(`/api/templates/${id}`),
    create: (data: Partial<Template>) =>
      request<Template>('/api/templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Template>) =>
      request<Template>(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/templates/${id}`, { method: 'DELETE' }),
    duplicate: (id: string) =>
      request<Template>(`/api/templates/${id}/duplicate`, { method: 'POST' }),
  },
  meetings: {
    list: () => request<Meeting[]>('/api/meetings'),
    upcoming: () => request<Meeting[]>('/api/meetings/upcoming'),
    archive: () => request<Meeting[]>('/api/meetings/archive'),
    get: (id: string) => request<Meeting>(`/api/meetings/${id}`),
    create: (data: Partial<Meeting>) =>
      request<Meeting>('/api/meetings', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Meeting>) =>
      request<Meeting>(`/api/meetings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/meetings/${id}`, { method: 'DELETE' }),
    updateItem: (meetingId: string, itemId: string, data: MeetingItemUpdate) =>
      request<{ success: boolean }>(`/api/meetings/${meetingId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  profile: {
    get: () => request<{ id: string; name: string; email: string }>('/api/profile'),
    update: (name: string) =>
      request<{ id: string; name: string; email: string }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ name }),
      }),
  },
};
