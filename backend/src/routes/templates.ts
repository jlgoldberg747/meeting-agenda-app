import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

export async function templateRoutes(fastify: FastifyInstance) {
  // GET /api/templates — list all templates for user
  fastify.get('/templates', { preHandler: requireAuth }, async (req, reply) => {
    const { data, error } = await supabaseAdmin
      .from('templates')
      .select('*, template_items(*)')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });

    // Sort items by position
    const templates = (data || []).map((t: any) => ({
      ...t,
      items: (t.template_items || []).sort((a: any, b: any) => a.position - b.position),
    }));

    return reply.send(templates);
  });

  // GET /api/templates/:id
  fastify.get<{ Params: { id: string } }>(
    '/templates/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { data, error } = await supabaseAdmin
        .from('templates')
        .select('*, template_items(*)')
        .eq('id', req.params.id)
        .eq('user_id', req.userId)
        .single();

      if (error) return reply.status(404).send({ error: 'Template not found' });

      return reply.send({
        ...data,
        items: (data.template_items || []).sort((a: any, b: any) => a.position - b.position),
      });
    }
  );

  // POST /api/templates — create template
  fastify.post<{ Body: any }>(
    '/templates',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { name, description, start_time, items } = req.body as any;

      const { data: template, error } = await supabaseAdmin
        .from('templates')
        .insert({ user_id: req.userId, name, description, start_time })
        .select()
        .single();

      if (error) return reply.status(500).send({ error: error.message });

      if (items && items.length > 0) {
        const itemRows = items.map((item: any, idx: number) => ({
          template_id: template.id,
          position: idx,
          title: item.title,
          duration_minutes: item.duration_minutes,
          format: item.format || 'O',
          objective: item.objective || '',
          illustration: item.illustration || '',
          approach: item.approach || '',
          is_break: item.is_break || false,
          notes: item.notes || '',
        }));

        const { error: itemError } = await supabaseAdmin
          .from('template_items')
          .insert(itemRows);

        if (itemError) return reply.status(500).send({ error: itemError.message });
      }

      // Return full template with items
      const { data: full } = await supabaseAdmin
        .from('templates')
        .select('*, template_items(*)')
        .eq('id', template.id)
        .single();

      return reply.status(201).send({
        ...full,
        items: ((full as any).template_items || []).sort((a: any, b: any) => a.position - b.position),
      });
    }
  );

  // PUT /api/templates/:id — update template (replaces all items)
  fastify.put<{ Params: { id: string }; Body: any }>(
    '/templates/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { name, description, start_time, items } = req.body as any;

      const { error } = await supabaseAdmin
        .from('templates')
        .update({ name, description, start_time })
        .eq('id', req.params.id)
        .eq('user_id', req.userId);

      if (error) return reply.status(500).send({ error: error.message });

      // Replace all items
      await supabaseAdmin.from('template_items').delete().eq('template_id', req.params.id);

      if (items && items.length > 0) {
        const itemRows = items.map((item: any, idx: number) => ({
          template_id: req.params.id,
          position: idx,
          title: item.title,
          duration_minutes: item.duration_minutes,
          format: item.format || 'O',
          objective: item.objective || '',
          illustration: item.illustration || '',
          approach: item.approach || '',
          is_break: item.is_break || false,
          notes: item.notes || '',
        }));

        const { error: itemError } = await supabaseAdmin
          .from('template_items')
          .insert(itemRows);

        if (itemError) return reply.status(500).send({ error: itemError.message });
      }

      const { data: full } = await supabaseAdmin
        .from('templates')
        .select('*, template_items(*)')
        .eq('id', req.params.id)
        .single();

      return reply.send({
        ...full,
        items: ((full as any).template_items || []).sort((a: any, b: any) => a.position - b.position),
      });
    }
  );

  // DELETE /api/templates/:id
  fastify.delete<{ Params: { id: string } }>(
    '/templates/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { error } = await supabaseAdmin
        .from('templates')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', req.userId);

      if (error) return reply.status(500).send({ error: error.message });
      return reply.send({ success: true });
    }
  );

  // POST /api/templates/:id/duplicate
  fastify.post<{ Params: { id: string } }>(
    '/templates/:id/duplicate',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { data: original, error } = await supabaseAdmin
        .from('templates')
        .select('*, template_items(*)')
        .eq('id', req.params.id)
        .eq('user_id', req.userId)
        .single();

      if (error || !original) return reply.status(404).send({ error: 'Template not found' });

      const { data: newTemplate, error: createError } = await supabaseAdmin
        .from('templates')
        .insert({
          user_id: req.userId,
          name: `${(original as any).name} (Copy)`,
          description: (original as any).description,
          start_time: (original as any).start_time,
        })
        .select()
        .single();

      if (createError) return reply.status(500).send({ error: createError.message });

      const origItems = ((original as any).template_items || []);
      if (origItems.length > 0) {
        const itemRows = origItems.map((item: any) => ({
          template_id: (newTemplate as any).id,
          position: item.position,
          title: item.title,
          duration_minutes: item.duration_minutes,
          format: item.format,
          objective: item.objective,
          illustration: item.illustration,
          approach: item.approach,
          is_break: item.is_break,
          notes: item.notes,
        }));

        await supabaseAdmin.from('template_items').insert(itemRows);
      }

      const { data: full } = await supabaseAdmin
        .from('templates')
        .select('*, template_items(*)')
        .eq('id', (newTemplate as any).id)
        .single();

      return reply.status(201).send({
        ...full,
        items: ((full as any).template_items || []).sort((a: any, b: any) => a.position - b.position),
      });
    }
  );
}
