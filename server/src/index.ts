import Fastify from 'fastify'
import corsPlugin from './plugins/cors.js'
import supabasePlugin from './plugins/supabase.js'
import authPlugin from './plugins/auth.js'
import healthRoutes from './routes/health.js'
import sessionsRoutes from './routes/sessions.js'
import attendanceRoutes from './routes/attendance.js'
import rfidRoutes from './routes/rfid.js'
import authRoutes from './routes/auth.js'
import classesRoutes from './routes/classes.js'
import studentsRoutes from './routes/students.js'
import familiesRoutes from './routes/families.js'
import rfidCardsRoutes from './routes/rfid-cards.js'

const fastify = Fastify({
  logger: true,
})

// Register plugins in dependency order:
// 1. CORS + Helmet (no dependencies)
// 2. Supabase service client (no dependencies)
// 3. Auth preHandler hook (depends on supabase env vars via createAnonClient)
await fastify.register(corsPlugin)
await fastify.register(supabasePlugin)
await fastify.register(authPlugin)

// Register routes
await fastify.register(healthRoutes)
await fastify.register(sessionsRoutes)
await fastify.register(attendanceRoutes)
await fastify.register(rfidRoutes)
await fastify.register(authRoutes)
await fastify.register(classesRoutes)
await fastify.register(studentsRoutes)
await fastify.register(familiesRoutes)
await fastify.register(rfidCardsRoutes)

const port = Number(process.env.PORT) || 3001
const host = '0.0.0.0'

try {
  await fastify.listen({ port, host })
  console.log(`Server listening on port ${port}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
