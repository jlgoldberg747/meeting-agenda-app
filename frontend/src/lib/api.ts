import { supabase } from './supabase';
import type { Template, Meeting, MeetingItemUpdate } from '../types';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? TEST_USER_ID;
}

// --- Templates ---
export const api = {
  templates: {
    list: async (): Promise<Template[]> => {
      const { data: templates, error } = await supabase
        .from('templates')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      // Fetch items for each template
      const ids = (templates || []).map(t => t.id);
      if (ids.length === 0) return [];
      const { data: items, error: itemsErr } = await supabase
        .from('template_items')
        .select('*')
        .in('template_id', ids)
        .order('position');
      if (itemsErr) throw new Error(itemsErr.message);
      return (templates || []).map(t => ({
        ...t,
        items: (items || []).filter(i => i.template_id === t.id),
      }));
    },

    get: async (id: string): Promise<Template> => {
      const { data: template, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      const { data: items, error: itemsErr } = await supabase
        .from('template_items')
        .select('*')
        .eq('template_id', id)
        .order('position');
      if (itemsErr) throw new Error(itemsErr.message);
      return { ...template, items: items || [] };
    },

    create: async (data: Partial<Template>): Promise<Template> => {
      const userId = await getUserId();
      const { items: itemsData, ...templateData } = data as any;
      const { data: template, error } = await supabase
        .from('templates')
        .insert({ ...templateData, user_id: userId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      if (itemsData && itemsData.length > 0) {
        const rows = itemsData.map((item: any, idx: number) => ({
          template_id: template.id,
          position: item.position ?? idx,
          title: item.title,
          duration_minutes: item.duration_minutes,
          format: item.format,
          objective: item.objective || '',
          illustration: item.illustration || '',
          approach: item.approach || '',
          is_break: item.is_break || false,
          notes: item.notes || '',
        }));
        const { error: itemsErr } = await supabase
          .from('template_items')
          .insert(rows);
        if (itemsErr) throw new Error(itemsErr.message);
      }
      return api.templates.get(template.id);
    },

    update: async (id: string, data: Partial<Template>): Promise<Template> => {
      const { items: itemsData, ...templateData } = data as any;
      // Remove fields that shouldn't be updated
      delete templateData.id;
      delete templateData.user_id;
      delete templateData.created_at;
      delete templateData.updated_at;

      const { error } = await supabase
        .from('templates')
        .update(templateData)
        .eq('id', id);
      if (error) throw new Error(error.message);

      if (itemsData) {
        // Delete existing items and re-insert
        const { error: delErr } = await supabase
          .from('template_items')
          .delete()
          .eq('template_id', id);
        if (delErr) throw new Error(delErr.message);

        if (itemsData.length > 0) {
          const rows = itemsData.map((item: any, idx: number) => ({
            template_id: id,
            position: item.position ?? idx,
            title: item.title,
            duration_minutes: item.duration_minutes,
            format: item.format,
            objective: item.objective || '',
            illustration: item.illustration || '',
            approach: item.approach || '',
            is_break: item.is_break || false,
            notes: item.notes || '',
          }));
          const { error: insErr } = await supabase
            .from('template_items')
            .insert(rows);
          if (insErr) throw new Error(insErr.message);
        }
      }
      return api.templates.get(id);
    },

    delete: async (id: string): Promise<{ success: boolean }> => {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },

    duplicate: async (id: string): Promise<Template> => {
      const original = await api.templates.get(id);
      return api.templates.create({
        name: `${original.name} (Copy)`,
        description: original.description,
        start_time: original.start_time,
        items: original.items.map((item, idx) => ({
          ...item,
          position: idx,
        })),
      } as any);
    },
  },

  meetings: {
    list: async (): Promise<Meeting[]> => {
      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw new Error(error.message);
      const ids = (meetings || []).map(m => m.id);
      if (ids.length === 0) return [];
      const { data: items, error: itemsErr } = await supabase
        .from('meeting_items')
        .select('*')
        .in('meeting_id', ids)
        .order('position');
      if (itemsErr) throw new Error(itemsErr.message);
      return (meetings || []).map(m => ({
        ...m,
        items: (items || []).filter(i => i.meeting_id === m.id),
      }));
    },

    upcoming: async (): Promise<Meeting[]> => {
      const today = new Date().toISOString().split('T')[0];
      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('*')
        .in('status', ['PLANNED', 'IN_PROGRESS'])
        .gte('date', today)
        .order('date');
      if (error) throw new Error(error.message);
      const ids = (meetings || []).map(m => m.id);
      if (ids.length === 0) return [];
      const { data: items, error: itemsErr } = await supabase
        .from('meeting_items')
        .select('*')
        .in('meeting_id', ids)
        .order('position');
      if (itemsErr) throw new Error(itemsErr.message);
      return (meetings || []).map(m => ({
        ...m,
        items: (items || []).filter(i => i.meeting_id === m.id),
      }));
    },

    archive: async (): Promise<Meeting[]> => {
      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('status', 'COMPLETED')
        .order('date', { ascending: false });
      if (error) throw new Error(error.message);
      const ids = (meetings || []).map(m => m.id);
      if (ids.length === 0) return [];
      const { data: items, error: itemsErr } = await supabase
        .from('meeting_items')
        .select('*')
        .in('meeting_id', ids)
        .order('position');
      if (itemsErr) throw new Error(itemsErr.message);
      return (meetings || []).map(m => ({
        ...m,
        items: (items || []).filter(i => i.meeting_id === m.id),
      }));
    },

    get: async (id: string): Promise<Meeting> => {
      const { data: meeting, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      const { data: items, error: itemsErr } = await supabase
        .from('meeting_items')
        .select('*')
        .eq('meeting_id', id)
        .order('position');
      if (itemsErr) throw new Error(itemsErr.message);
      return { ...meeting, items: items || [] };
    },

    create: async (data: Partial<Meeting>): Promise<Meeting> => {
      const userId = await getUserId();
      const { items: itemsData, ...meetingData } = data as any;
      // Remove fields that shouldn't be inserted
      delete meetingData.id;
      delete meetingData.created_at;
      delete meetingData.updated_at;

      const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({ ...meetingData, user_id: userId })
        .select()
        .single();
      if (error) throw new Error(error.message);

      if (itemsData && itemsData.length > 0) {
        const rows = itemsData.map((item: any, idx: number) => ({
          meeting_id: meeting.id,
          position: item.position ?? idx,
          title: item.title,
          duration_minutes: item.duration_minutes,
          format: item.format,
          objective: item.objective || '',
          illustration: item.illustration || '',
          approach: item.approach || '',
          is_break: item.is_break || false,
          notes: item.notes || '',
        }));
        const { error: itemsErr } = await supabase
          .from('meeting_items')
          .insert(rows);
        if (itemsErr) throw new Error(itemsErr.message);
      }
      return api.meetings.get(meeting.id);
    },

    update: async (id: string, data: Partial<Meeting>): Promise<Meeting> => {
      const { items: itemsData, ...meetingData } = data as any;
      delete meetingData.id;
      delete meetingData.user_id;
      delete meetingData.created_at;
      delete meetingData.updated_at;

      const { error } = await supabase
        .from('meetings')
        .update(meetingData)
        .eq('id', id);
      if (error) throw new Error(error.message);

      if (itemsData) {
        // Delete existing items and re-insert
        const { error: delErr } = await supabase
          .from('meeting_items')
          .delete()
          .eq('meeting_id', id);
        if (delErr) throw new Error(delErr.message);

        if (itemsData.length > 0) {
          const rows = itemsData.map((item: any, idx: number) => ({
            meeting_id: id,
            position: item.position ?? idx,
            title: item.title,
            duration_minutes: item.duration_minutes,
            format: item.format,
            objective: item.objective || '',
            illustration: item.illustration || '',
            approach: item.approach || '',
            is_break: item.is_break || false,
            notes: item.notes || '',
            status: item.status || 'pending',
            actual_start_at: item.actual_start_at || null,
            actual_end_at: item.actual_end_at || null,
            actual_duration_minutes: item.actual_duration_minutes || null,
          }));
          const { error: insErr } = await supabase
            .from('meeting_items')
            .insert(rows);
          if (insErr) throw new Error(insErr.message);
        }
      }
      return api.meetings.get(id);
    },

    delete: async (id: string): Promise<{ success: boolean }> => {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },

    updateItem: async (
      meetingId: string,
      itemId: string,
      data: MeetingItemUpdate
    ): Promise<{ success: boolean }> => {
      const { error } = await supabase
        .from('meeting_items')
        .update(data)
        .eq('id', itemId)
        .eq('meeting_id', meetingId);
      if (error) throw new Error(error.message);
      return { success: true };
    },
  },

  profile: {
    get: async (): Promise<{ id: string; name: string; email: string }> => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', userId)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    update: async (name: string): Promise<{ id: string; name: string; email: string }> => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('profiles')
        .update({ name })
        .eq('id', userId)
        .select('id, name, email')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
};
