import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

function sortItems(items: any[]) {
  return (items || []).sort((a, b) => a.position - b.position);
}

async function getMeetingFull(id: string) {
  const { data } = await supabaseAdmin
    .from('meetings')
    .select('*, meeting_items(*)')
    .eq('id', id)
    .single();
  if (!data) return null;
  return { ...data, items: sortItems((data as any).meeting_items) };
}

export async function meetingRoutes(fastify: FastifyInstance) {
  // GET /api/meetings
  fastify.get('/meetings', { preHandler: requireAuth }, async (req, reply) => {
    const { data, error } = await supabaseAdmin
      .from('meetings')
      .select('*, meeting_items(*)')
      .eq('user_id', req.userId)
      .order('date', { ascending: true });

    if (error) return reply.status(500).send({ error: error.message });

    const meetings = (data || []).map((m: any) => ({
      ...m,
      items: sortItems(m.meeting_items || []),
    }));

    return reply.send(meetings);
  });

  // GET /api/meetings/upcoming
  fastify.get('/meetings/upcoming', { preHandler: requireAuth }, async (req, reply) => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabaseAdmin
      .from('meetings')
      .select('*, meeting_items(*)')
      .eq('user_id', req.userId)
      .gte('date', today)
      .in('status', ['PLANNED', 'IN_PROGRESS'])
      .order('date', { ascending: true });

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send((data || []).map((m: any) => ({ ...m, items: sortItems(m.meeting_items || []) })));
  });

  // GET /api/meetings/archive
  fastify.get('/meetings/archive', { preHandler: requireAuth }, async (req, reply) => {
    const { data, error } = await supabaseAdmin
      .from('meetings')
      .select('*, meeting_items(*)')
      .eq('user_id', req.userId)
      .eq('status', 'COMPLETED')
      .order('date', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send((data || []).map((m: any) => ({ ...m, items: sortItems(m.meeting_items || []) })));
  });

  // GET /api/meetings/:id
  fastify.get<{ Params: { id: string } }>(
    '/meetings/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { data, error } = await supabaseAdmin
        .from('meetings')
        .select('*, meeting_items(*)')
        .eq('id', req.params.id)
        .eq('user_id', req.userId)
        .single();

      if (error || !data) return reply.status(404).send({ error: 'Meeting not found' });
      return reply.send({ ...data, items: sortItems((data as any).meeting_items || []) });
    }
  );

  // POST /api/meetings — create meeting
  fastify.post<{ Body: any }>(
    '/meetings',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { title, subtitle, date, start_time, location, facilitator, participants, template_id, items, organisation, alarms_enabled, alarm_minutes_before, alarm_type } = req.body as any;

      const { data: meeting, error } = await supabaseAdmin
        .from('meetings')
        .insert({
          user_id: req.userId,
          template_id: template_id || null,
          organisation: organisation || '',
          title,
          subtitle: subtitle || '',
          date,
          start_time: start_time || '09:00',
          location: location || '',
          facilitator: facilitator || '',
          participants: participants || [],
          status: 'PLANNED',
          alarms_enabled: alarms_enabled ?? true,
          alarm_minutes_before: alarm_minutes_before ?? 1,
          alarm_type: alarm_type || 'chime',
        })
        .select()
        .single();

      if (error) return reply.status(500).send({ error: error.message });

      // If template_id provided and no items, copy from template
      let agendaItems = items;
      if (!agendaItems?.length && template_id) {
        const { data: tpl } = await supabaseAdmin
          .from('template_items')
          .select('*')
          .eq('template_id', template_id)
          .order('position');
        agendaItems = tpl || [];
      }

      if (agendaItems && agendaItems.length > 0) {
        const itemRows = agendaItems.map((item: any, idx: number) => ({
          meeting_id: (meeting as any).id,
          position: idx,
          title: item.title,
          duration_minutes: item.duration_minutes,
          format: item.format || 'O',
          objective: item.objective || '',
          illustration: item.illustration || '',
          approach: item.approach || '',
          is_break: item.is_break || false,
          notes: item.notes || '',
          status: 'pending',
        }));
        await supabaseAdmin.from('meeting_items').insert(itemRows);
      }

      const full = await getMeetingFull((meeting as any).id);
      return reply.status(201).send(full);
    }
  );

  // PUT /api/meetings/:id — update meeting details
  fastify.put<{ Params: { id: string }; Body: any }>(
    '/meetings/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { title, subtitle, date, start_time, location, facilitator, participants, notes, status, actual_start_at, actual_end_at, items, organisation, alarms_enabled, alarm_minutes_before, alarm_type } = req.body as any;

      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (subtitle !== undefined) updates.subtitle = subtitle;
      if (date !== undefined) updates.date = date;
      if (start_time !== undefined) updates.start_time = start_time;
      if (location !== undefined) updates.location = location;
      if (facilitator !== undefined) updates.facilitator = facilitator;
      if (participants !== undefined) updates.participants = participants;
      if (notes !== undefined) updates.notes = notes;
      if (status !== undefined) updates.status = status;
      if (actual_start_at !== undefined) updates.actual_start_at = actual_start_at;
      if (actual_end_at !== undefined) updates.actual_end_at = actual_end_at;
      if (organisation !== undefined) updates.organisation = organisation;
      if (alarms_enabled !== undefined) updates.alarms_enabled = alarms_enabled;
      if (alarm_minutes_before !== undefined) updates.alarm_minutes_before = alarm_minutes_before;
      if (alarm_type !== undefined) updates.alarm_type = alarm_type;

      const { error } = await supabaseAdmin
        .from('meetings')
        .update(updates)
        .eq('id', req.params.id)
        .eq('user_id', req.userId);

      if (error) return reply.status(500).send({ error: error.message });

      // If items provided, replace all items
      if (items !== undefined) {
        await supabaseAdmin.from('meeting_items').delete().eq('meeting_id', req.params.id);
        if (items.length > 0) {
          const itemRows = items.map((item: any, idx: number) => ({
            meeting_id: req.params.id,
            position: idx,
            title: item.title,
            duration_minutes: item.duration_minutes,
            format: item.format || 'O',
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
          const { error: ie } = await supabaseAdmin.from('meeting_items').insert(itemRows);
          if (ie) return reply.status(500).send({ error: ie.message });
        }
      }

      const full = await getMeetingFull(req.params.id);
      return reply.send(full);
    }
  );

  // PATCH /api/meetings/:id/items/:itemId — update a single item (for live meeting)
  fastify.patch<{ Params: { id: string; itemId: string }; Body: any }>(
    '/meetings/:id/items/:itemId',
    { preHandler: requireAuth },
    async (req, reply) => {
      // Verify meeting ownership
      const { data: meeting } = await supabaseAdmin
        .from('meetings')
        .select('id')
        .eq('id', req.params.id)
        .eq('user_id', req.userId)
        .single();

      if (!meeting) return reply.status(404).send({ error: 'Meeting not found' });

      const allowed = ['status', 'actual_start_at', 'actual_end_at', 'actual_duration_minutes', 'notes'];
      const updates: any = {};
      for (const key of allowed) {
        if ((req.body as any)[key] !== undefined) updates[key] = (req.body as any)[key];
      }

      const { error } = await supabaseAdmin
        .from('meeting_items')
        .update(updates)
        .eq('id', req.params.itemId)
        .eq('meeting_id', req.params.id);

      if (error) return reply.status(500).send({ error: error.message });
      return reply.send({ success: true });
    }
  );

  // DELETE /api/meetings/:id
  fastify.delete<{ Params: { id: string } }>(
    '/meetings/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { error } = await supabaseAdmin
        .from('meetings')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', req.userId);

      if (error) return reply.status(500).send({ error: error.message });
      return reply.send({ success: true });
    }
  );

  // GET /api/profile
  fastify.get('/profile', { preHandler: requireAuth }, async (req, reply) => {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.userId)
      .single();

    if (error) return reply.status(404).send({ error: 'Profile not found' });
    return reply.send(data);
  });

  // PUT /api/profile
  fastify.put<{ Body: any }>(
    '/profile',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { name } = req.body as any;
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ name })
        .eq('id', req.userId)
        .select()
        .single();

      if (error) return reply.status(500).send({ error: error.message });
      return reply.send(data);
    }
  );
}
