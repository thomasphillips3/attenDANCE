import { Type, Static } from 'typebox'
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

// TypeBox schema for GET /sessions/today — one entry per class_session today
export const SessionSummary = Type.Object({
  id: Type.String(),
  classId: Type.String(),
  className: Type.String(),
  instructorName: Type.Optional(Type.String()),
  startTime: Type.String(),         // "HH:MM" 24h from classes.start_time
  durationMinutes: Type.Number(),
  sessionDate: Type.String(),       // "YYYY-MM-DD"
  status: Type.Union([
    Type.Literal('scheduled'), Type.Literal('completed'), Type.Literal('cancelled'),
  ]),
  presentCount: Type.Number(),
  totalEnrolled: Type.Number(),
})
export type SessionSummary = Static<typeof SessionSummary>

// TypeBox schema for GET /sessions/:id/roster — one entry per enrolled student
export const RosterStudent = Type.Object({
  studentId: Type.String(),
  enrollmentId: Type.String(),
  firstName: Type.String(),
  lastName: Type.String(),
  attendanceId: Type.Optional(Type.String()),
  attendanceStatus: Type.Optional(Type.Union([
    Type.Literal('present'), Type.Literal('absent'),
    Type.Literal('late'), Type.Literal('excused'),
  ])),
})
export type RosterStudent = Static<typeof RosterStudent>
