import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type { NotificationListQuery, BroadcastBody } from '../types/index.js'
import { sendEmail, sendSMS } from '../lib/notifications.js'
import { announcementEmail } from '../lib/email-templates.js'

/**
 * Notification routes -- admin-only access to notification_log + broadcast.
 *
 * GET  /notifications           -- paginated list of sent notifications for the org
 * POST /notifications/broadcast -- send a message to families (filtered by class)
 *
 * Organization scope from JWT app_metadata. Admin role gate enforced.
 */
const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // ---------------------------------------------------------------------------
  // GET /notifications -- list notification log entries
  // ---------------------------------------------------------------------------
  fastify.get<{ Querystring: NotificationListQuery }>(
    '/notifications',
    async (request, reply) => {
      const organizationId = request.organizationId

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      const limit = Math.min(Number(request.query.limit) || 25, 100)
      const offset = Number(request.query.offset) || 0
      const channel = request.query.channel

      // Build query with org scope
      let query = fastify.supabase
        .from('notification_log')
        .select('id, organization_id, family_id, student_id, type, recipient, subject, template_key, payload, delivery_status, external_id, error_message, sent_at, created_at', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (channel) {
        query = query.eq('type', channel)
      }

      const { data, error, count } = await query

      if (error) {
        fastify.log.error({ error }, 'Failed to fetch notifications')
        return reply.code(500).send({ error: 'Failed to fetch notifications' })
      }

      return reply.code(200).send({
        data: data ?? [],
        total: count ?? 0,
        limit,
        offset,
      })
    },
  )

  // ---------------------------------------------------------------------------
  // POST /notifications/broadcast -- admin-only broadcast to families (COMM-06)
  //
  // Body: { channel: 'email'|'sms'|'both', classIds?: uuid[], subject?: string, message: string }
  //
  // If classIds provided: query enrolled students -> families -> deduplicate by family.
  // If no classIds: send to all active families in the org.
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: BroadcastBody }>(
    '/notifications/broadcast',
    async (request, reply) => {
      const organizationId = request.organizationId

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      const { channel, classIds, subject, message } = request.body

      // Validate: email channel requires a subject
      if ((channel === 'email' || channel === 'both') && !subject) {
        return reply.code(400).send({ error: 'Subject is required for email broadcasts' })
      }

      // Build the list of target families
      let families: Array<{ id: string; email: string | null; phone: string | null }> = []

      if (classIds && classIds.length > 0) {
        // Get families with students enrolled in the specified classes
        const { data: enrollments, error: enrollErr } = await fastify.supabase
          .from('enrollments')
          .select('students!inner(family_id)')
          .eq('organization_id', organizationId)
          .eq('status', 'active')
          .in('class_id', classIds)

        if (enrollErr) {
          fastify.log.error({ error: enrollErr }, 'Failed to query enrollments for broadcast')
          return reply.code(500).send({ error: 'Failed to query enrollments' })
        }

        // Extract unique family IDs from enrollments
        const familyIds = [
          ...new Set(
            (enrollments ?? [])
              .map((e) => {
                const student = e.students as unknown as { family_id: string } | null
                return student?.family_id
              })
              .filter((id): id is string => !!id),
          ),
        ]

        if (familyIds.length === 0) {
          return reply.code(200).send({ sent: 0, message: 'No families found for selected classes' })
        }

        // Fetch family contact info
        const { data: familyRows, error: familyErr } = await fastify.supabase
          .from('families')
          .select('id, email, phone')
          .eq('organization_id', organizationId)
          .in('id', familyIds)

        if (familyErr) {
          fastify.log.error({ error: familyErr }, 'Failed to fetch families for broadcast')
          return reply.code(500).send({ error: 'Failed to fetch families' })
        }

        families = familyRows ?? []
      } else {
        // No class filter -- send to all families in the org
        const { data: allFamilies, error: allErr } = await fastify.supabase
          .from('families')
          .select('id, email, phone')
          .eq('organization_id', organizationId)

        if (allErr) {
          fastify.log.error({ error: allErr }, 'Failed to fetch all families for broadcast')
          return reply.code(500).send({ error: 'Failed to fetch families' })
        }

        families = allFamilies ?? []
      }

      if (families.length === 0) {
        return reply.code(200).send({ sent: 0, message: 'No families found' })
      }

      let sentCount = 0

      for (const family of families) {
        // Send email if channel is email or both
        if ((channel === 'email' || channel === 'both') && family.email) {
          sendEmail(fastify.supabase, {
            organizationId,
            familyId: family.id,
            to: family.email,
            subject: subject!,
            html: announcementEmail(subject!, message),
            templateKey: 'broadcast',
            payload: { subject, message, channel },
          }, fastify.log).catch(() => {})
          sentCount++
        }

        // Send SMS if channel is sms or both
        if ((channel === 'sms' || channel === 'both') && family.phone) {
          sendSMS(fastify.supabase, {
            organizationId,
            familyId: family.id,
            to: family.phone,
            body: message,
            templateKey: 'broadcast_sms',
            payload: { message, channel },
          }, fastify.log).catch(() => {})
          sentCount++
        }
      }

      return reply.code(200).send({
        sent: sentCount,
        families: families.length,
        message: `Broadcast sent to ${families.length} families (${sentCount} messages)`,
      })
    },
  )
}

export default fp(notificationRoutes, {
  name: 'notifications',
  dependencies: ['supabase', 'auth'],
})
