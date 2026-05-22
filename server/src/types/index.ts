import { Type, Static } from '@sinclair/typebox'
import type { User } from '@supabase/supabase-js'

// Augment FastifyRequest to carry the verified Supabase user + extracted claims.
// auth.ts populates these fields on every authenticated request.
declare module 'fastify' {
  interface FastifyRequest {
    user: User | undefined
    organizationId: string | undefined
    role: string | undefined
  }
}

// TypeBox schema for GET /health (open endpoint)
export const HealthResponse = Type.Object({
  status: Type.Literal('ok'),
  timestamp: Type.String(),
})
export type HealthResponse = Static<typeof HealthResponse>

// TypeBox schema for GET /health/authed (JWT-gated endpoint)
export const AuthedHealthResponse = Type.Object({
  status: Type.Literal('ok'),
  role: Type.Optional(Type.String()),
  organizationId: Type.Optional(Type.String()),
  timestamp: Type.String(),
})
export type AuthedHealthResponse = Static<typeof AuthedHealthResponse>
