import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type { NotificationListQuery } from '../types/index.js'

/**
 * Notification routes -- admin-only read access to notification_log.
 *
 * GET /notifications -- paginated list of sent notifications for the org,
 * with optional ?channel filter (email/sms) and ?limit/?offset pagination.
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
}

export default fp(notificationRoutes, {
  name: 'notifications',
  dependencies: ['supabase', 'auth'],
})
