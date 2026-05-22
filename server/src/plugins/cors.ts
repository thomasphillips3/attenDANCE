import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import type { FastifyPluginAsync } from 'fastify'

/**
 * CORS + Helmet plugin.
 *
 * CORS_ORIGIN defaults to '*' for local dev. In production, set this to
 * the exact Vercel deployment URL (e.g. https://lsodance.vercel.app).
 *
 * Helmet sets security headers (X-Frame-Options, CSP, HSTS, etc.).
 */
const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
  })

  await fastify.register(helmet, {
    contentSecurityPolicy: false, // API-only server; no HTML served
  })
}

export default fp(corsPlugin, {
  name: 'cors',
})
